import { makeId, slugify } from "./id";
import type {
  ArchitectureMap,
  Implementation,
  ImplementationRun,
  IterationPractice,
  IterationState,
  NodeReference,
  QuizQuestion,
  ZenithReference,
} from "./types";

// Phase 1 stand-in for the real Convex action + Anthropic call (see spec section 3).
// Deterministic and local so the UI and interaction logic can be built and tested
// end to end before any server, auth, or billing exists.
//
// This is a keyword-classified content model, not one fixed template reused for
// every topic: the topic is matched against a handful of categories (networking,
// language, systems, security, data, process, falling back to a general shape),
// and the architecture map, zenith reference, and implementation angles all pull
// from the same per-category content so a given topic feels coherent rather than
// a generic skeleton with the topic string swapped in.

const NETWORK_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CategoryNode {
  label: string;
  description: (topic: string) => string;
  insight: string;
}

interface CategoryPhase {
  title: string;
  summary: string;
  nodes: CategoryNode[];
}

interface AngleTemplate {
  angle: string;
  situation: string;
}

interface TopicCategory {
  id: string;
  keywords: string[];
  phases: CategoryPhase[];
  angles: AngleTemplate[];
}

const CATEGORIES: TopicCategory[] = [
  {
    id: "security",
    keywords: [
      "security", "encryption", "cryptograph", "vulnerab", "exploit", "penetration",
      "threat model", "authentication", "authorization", "malware", "attack surface",
    ],
    phases: [
      {
        title: "Threat Foundations",
        summary: "What's actually at risk, and who's realistically trying to get at it.",
        nodes: [
          {
            label: "asset and attack surface mapping",
            description: (t) => `What's actually valuable in ${t}, and every path an attacker could realistically use to reach it.`,
            insight: "You can't defend what you haven't inventoried. Most breaches start in the part nobody mapped.",
          },
          {
            label: "threat modeling assumptions",
            description: (t) => `Who ${t} is actually being defended against, and what capability level that adversary realistically has.`,
            insight: "Defending against a nation-state and defending against opportunistic scanning require different tradeoffs. Conflating them wastes effort in both directions.",
          },
          {
            label: "trust boundary identification",
            description: (t) => `Where ${t} stops trusting input and starts verifying it, explicitly.`,
            insight: "Every unlabeled trust boundary is a place where \"someone else validates this\" quietly becomes true for no one.",
          },
        ],
      },
      {
        title: "Defense Mechanics",
        summary: "The controls that actually hold up once someone is trying to get past them.",
        nodes: [
          {
            label: "authentication and session integrity",
            description: (t) => `How ${t} confirms who's on the other end, and keeps that confirmation from being hijacked mid-session.`,
            insight: "A strong login and a weak session token is still a broken system, just a slower one to break.",
          },
          {
            label: "encryption and key management",
            description: (t) => `How ${t} keeps data unreadable to everyone except the intended recipient, and how it manages the keys that make that true.`,
            insight: "Encryption with poor key management is theater. The algorithm was never the weak point.",
          },
          {
            label: "input validation and boundary enforcement",
            description: (t) => `How ${t} treats every piece of external input as hostile until proven otherwise.`,
            insight: "The exploit almost never breaks the algorithm. It walks in through the input nobody validated.",
          },
        ],
      },
      {
        title: "Real-World Pressure",
        summary: "How this holds up once an actual incident is underway.",
        nodes: [
          {
            label: "incident response under active exploitation",
            description: (t) => `What you actually do the moment you find out ${t} is being actively exploited, in order, without making it worse.`,
            insight: "The instinct to immediately patch live can destroy the evidence you need to know what actually happened.",
          },
          {
            label: "patch and disclosure tradeoffs",
            description: (t) => `How fast ${t} can realistically be patched, and who needs to know before that patch ships.`,
            insight: "A rushed patch that breaks production is its own incident. Speed and correctness are in real tension here.",
          },
          {
            label: "post-incident hardening",
            description: (t) => `What actually changes in ${t} after an incident, versus what just gets a retrospective doc nobody rereads.`,
            insight: "If the same class of vulnerability can happen again the same way, the incident didn't actually close.",
          },
        ],
      },
    ],
    angles: [
      { angle: "under active exploitation", situation: "an attacker is already inside and every move you make is visible to them too" },
      { angle: "with a zero-day", situation: "there's no patch yet and you have to reduce exposure some other way" },
      { angle: "during a compliance audit", situation: "you have to prove the control actually works, not just that it exists on paper" },
      { angle: "with an insider threat", situation: "the person with legitimate access is the one you can't fully trust" },
      { angle: "under public disclosure pressure", situation: "a researcher is about to go public before you're ready" },
      { angle: "during a merger or acquisition", situation: "you're inheriting a system with a threat model nobody documented" },
      { angle: "with legacy systems that can't be patched", situation: "the fix would break something else that still depends on the old behavior" },
      { angle: "explaining the risk to non-technical stakeholders", situation: "you have to make the tradeoff legible without the jargon" },
      { angle: "at 10x normal traffic", situation: "the same defenses have to hold under conditions they were never load-tested for" },
      { angle: "post-incident", situation: "you have to prove the same failure genuinely can't happen the same way twice" },
    ],
  },
  {
    id: "data",
    keywords: [
      "machine learning", " ml ", " ai ", "data pipeline", "algorithm", "neural network",
      "model training", "data science", "deep learning", "llm", "artificial intelligence",
    ],
    phases: [
      {
        title: "Data Foundations",
        summary: "What the model or algorithm is actually learning from, and what's wrong with it before anyone touched a model.",
        nodes: [
          {
            label: "data collection and labeling quality",
            description: (t) => `Where the data behind ${t} actually comes from, and what bias or gap got baked in before anyone touched a model.`,
            insight: "A model can't be more correct than the labels it was trained on. Garbage labels are a silent ceiling on quality.",
          },
          {
            label: "feature representation",
            description: (t) => `How raw signal gets turned into something ${t} can actually learn from.`,
            insight: "The right representation makes an easy problem out of a hard one. The wrong one makes an impossible problem out of an easy one.",
          },
          {
            label: "data drift and staleness",
            description: (t) => `How the real-world data ${t} sees in production quietly stops matching what it was trained on.`,
            insight: "Drift doesn't announce itself. Performance just degrades until someone notices, usually a customer first.",
          },
        ],
      },
      {
        title: "Modeling Mechanics",
        summary: "How the thing actually gets built, tuned, and judged.",
        nodes: [
          {
            label: "training and optimization loop",
            description: (t) => `The actual loop ${t} runs to get from random weights to something useful.`,
            insight: "Most training bugs aren't in the model, they're in the loop feeding it data wrong without erroring.",
          },
          {
            label: "evaluation and generalization",
            description: (t) => `How you know ${t} actually learned the pattern, instead of just memorizing the training set.`,
            insight: "A model that aces its test set and fails in production usually leaked test data into training somewhere.",
          },
          {
            label: "model selection tradeoffs",
            description: (t) => `What you're actually trading away by picking a simpler or more complex approach for ${t}.`,
            insight: "The fanciest model available is rarely the right one. Interpretability and latency are real costs, not nice-to-haves.",
          },
        ],
      },
      {
        title: "Deployment Reality",
        summary: "What happens once this has to run for real users, continuously.",
        nodes: [
          {
            label: "drift detection and monitoring",
            description: (t) => `How you'd actually notice ${t} degrading in production before a user complains about it.`,
            insight: "If your only feedback signal is a support ticket, you don't have monitoring, you have a lagging indicator.",
          },
          {
            label: "inference cost and latency budget",
            description: (t) => `What it actually costs, in time and money, to get a prediction out of ${t} at the volume you need.`,
            insight: "An accuracy gain that doubles inference cost isn't automatically worth it. Someone has to say no to it explicitly.",
          },
          {
            label: "failure mode and fallback behavior",
            description: (t) => `What ${t} does when it's uncertain or wrong, and whether that failure is graceful or silent.`,
            insight: "A confidently wrong answer is worse than a system that says \"I don't know.\" Most systems don't build for the second option.",
          },
        ],
      },
    ],
    angles: [
      { angle: "under peak inference load", situation: "requests queue and latency creeps past what users will tolerate" },
      { angle: "with a shifted data distribution", situation: "production data no longer looks like the training set" },
      { angle: "during a model rollback", situation: "the new version underperforms and you have to revert without losing ground" },
      { angle: "with an adversarial input", situation: "someone is deliberately probing for the failure mode" },
      { angle: "under a tight compute budget", situation: "you can't just throw more resources at the accuracy problem" },
      { angle: "explaining a wrong prediction to a stakeholder", situation: "you have to say why, not just that it happened" },
      { angle: "with incomplete or biased labels", situation: "the ground truth itself is the weakest link" },
      { angle: "during a live A/B test", situation: "you have to tell signal from noise before the business commits to a direction" },
      { angle: "at 10x normal data volume", situation: "the pipeline that worked at the old scale starts silently dropping or delaying records" },
      { angle: "handing the model off to another team", situation: "they need to operate it without your context" },
    ],
  },
  {
    id: "systems",
    keywords: [
      "kernel", "linux", "operating system", " os ", "distributed system", "database",
      "kubernetes", "docker", "infrastructure", "cloud", "microservice", "container", "cluster", "orchestration",
    ],
    phases: [
      {
        title: "Core Primitives",
        summary: "The basic units of work, storage, and scheduling everything else is built from.",
        nodes: [
          {
            label: "process and resource model",
            description: (t) => `How ${t} carves up CPU, memory, and I/O between competing units of work.`,
            insight: "Resource limits that look generous in isolation get adversarial fast once things actually contend for them.",
          },
          {
            label: "scheduling and concurrency",
            description: (t) => `How ${t} decides what runs next, and what a unit of work is guaranteed about fairness and ordering.`,
            insight: "A scheduler that's fair on average can still starve a specific workload forever.",
          },
          {
            label: "storage and persistence layer",
            description: (t) => `How ${t} makes sure data survives a crash, and what "durable" actually means once you read the fine print.`,
            insight: "Durability guarantees are only as strong as the weakest layer underneath them, including the disk firmware.",
          },
        ],
      },
      {
        title: "Coordination at Scale",
        summary: "What has to be true for many nodes to agree on one shared reality.",
        nodes: [
          {
            label: "consensus and replication",
            description: (t) => `How ${t} keeps multiple copies of the same data in agreement, even when messages get lost or delayed.`,
            insight: "Consensus is expensive by design. The systems that skip it are making a bet, whether they admit it or not.",
          },
          {
            label: "failure detection and recovery",
            description: (t) => `How ${t} tells the difference between a slow node and a dead one, and what it does about either.`,
            insight: "You cannot reliably distinguish \"slow\" from \"dead\" over a network. Every system picks a timeout and lives with being wrong sometimes.",
          },
          {
            label: "partitioning and load distribution",
            description: (t) => `How ${t} spreads work and data across nodes so no single one becomes the bottleneck.`,
            insight: "An even hash distribution on paper still produces hot keys the moment real traffic isn't uniform.",
          },
        ],
      },
      {
        title: "Operating It For Real",
        summary: "What it takes to run this in production, not just get it working once.",
        nodes: [
          {
            label: "capacity planning and scaling triggers",
            description: (t) => `How you know ${t} needs more resources before it's already too late.`,
            insight: "By the time the alert fires, you're usually already behind. Good capacity planning is boring, which is the point.",
          },
          {
            label: "upgrade and rollback strategy",
            description: (t) => `How you change a running ${t} deployment without taking it down, and how you undo it if it goes wrong.`,
            insight: "If you haven't tested the rollback, you don't have a rollback plan, you have a hope.",
          },
          {
            label: "incident diagnosis playbook",
            description: (t) => `The order of checks that gets you from "something's wrong with ${t}" to the actual root cause, fast.`,
            insight: "Under pressure, people default to the checks they've memorized, not the ones that are actually relevant.",
          },
        ],
      },
    ],
    angles: [
      { angle: "under peak load", situation: "traffic spikes past anything capacity planning accounted for" },
      { angle: "during a partial rollout", situation: "only some nodes are running the new version" },
      { angle: "when a downstream dependency degrades", situation: "something you depend on slows down without fully failing" },
      { angle: "during a region or zone outage", situation: "an entire slice of infrastructure disappears at once" },
      { angle: "with a noisy neighbor", situation: "another workload on shared infrastructure is starving your resources" },
      { angle: "mid-migration", situation: "half your data is in the old system and half is in the new one" },
      { angle: "under a security patch deadline", situation: "you have to update a running system fast, without breaking it" },
      { angle: "during a live incident", situation: "it's already down and every command carries risk" },
      { angle: "at 10x normal scale", situation: "the assumptions that held at the original scale quietly stop holding" },
      { angle: "handing it off to on-call", situation: "someone with less context has to be able to operate this at 3am" },
    ],
  },
  {
    id: "networking",
    keywords: [
      "network", "tcp", "udp", "http", "dns", "protocol", "socket", "packet", "handshake",
      "api", "rest", "grpc", "websocket", "routing", "bgp", "ip address", "firewall", "load balanc",
    ],
    phases: [
      {
        title: "Wire Protocol Fundamentals",
        summary: "What actually travels over the wire and how the two ends agree on what it means.",
        nodes: [
          {
            label: "message framing and encoding",
            description: (t) => `How ${t} decides where one message ends and the next begins, and what breaks if that boundary is read wrong.`,
            insight: "Get the framing wrong and every layer built on top inherits a silent corruption bug.",
          },
          {
            label: "connection establishment and lifecycle",
            description: (t) => `The sequence ${t} uses to go from nothing to a live, trusted channel, and how it tears that channel down cleanly.`,
            insight: "Most implementations nail the happy path and never test the teardown.",
          },
          {
            label: "addressing and endpoint identity",
            description: (t) => `How ${t} names the two sides of a conversation so a message actually reaches the right place.`,
            insight: "Identity and location get conflated more often than expected, and that's where routing bugs hide.",
          },
        ],
      },
      {
        title: "Reliability and Flow Control",
        summary: "How the exchange survives loss, reordering, and a receiver that can't keep up.",
        nodes: [
          {
            label: "acknowledgment and retransmission",
            description: (t) => `How ${t} knows a message actually arrived, and what it does when it doesn't hear back in time.`,
            insight: "A retry policy with no backoff is just a self-inflicted denial of service.",
          },
          {
            label: "flow control and backpressure",
            description: (t) => `How ${t} keeps a fast sender from drowning a slow receiver.`,
            insight: "The failure mode is rarely a crash, it's a slow, invisible queue that nobody notices until it's too late.",
          },
          {
            label: "ordering and sequencing guarantees",
            description: (t) => `What ${t} promises about the order messages arrive in, and what happens the moment that promise is violated.`,
            insight: "Out-of-order delivery is the default in a distributed system, not the exception.",
          },
        ],
      },
      {
        title: "Production Realities",
        summary: "Where the clean protocol diagram meets NAT boxes, firewalls, and real operators.",
        nodes: [
          {
            label: "middlebox and NAT interference",
            description: (t) => `How firewalls, proxies, and NAT devices reshape ${t} in transit, often in ways the spec never anticipated.`,
            insight: "The spec describes two endpoints. Production has five boxes in between, each with an opinion.",
          },
          {
            label: "security and encryption layering",
            description: (t) => `Where encryption gets bolted onto ${t}, and what it costs in latency and complexity to do it right.`,
            insight: "Bolting security on after the fact is how you end up with a downgrade attack nobody planned for.",
          },
          {
            label: "observability and failure diagnosis",
            description: (t) => `What you actually need visible to tell why a specific ${t} exchange failed, days after the fact.`,
            insight: "If you can't reconstruct what happened from the logs, you don't understand the system, you're guessing.",
          },
        ],
      },
    ],
    angles: [
      { angle: "under peak load", situation: "connections queue and the retry storm starts feeding on itself" },
      { angle: "across an unreliable link", situation: "packets drop or arrive out of order mid-exchange" },
      { angle: "through a NAT or corporate firewall", situation: "a middlebox silently rewrites or blocks what you expected to pass through untouched" },
      { angle: "during a rolling deployment", situation: "one side has the new behavior and the other doesn't yet" },
      { angle: "with a misbehaving client", situation: "the other end doesn't follow the protocol the way the spec assumes" },
      { angle: "under a compliance audit", situation: "you have to prove exactly what was sent, when, and to whom" },
      { angle: "at 10x normal connection volume", situation: "file descriptors and ephemeral ports start running out" },
      { angle: "with a partial network partition", situation: "some nodes can reach each other and some can't, at the same time" },
      { angle: "during a live incident", situation: "it's already degraded and every retry makes it worse" },
      { angle: "explaining a packet capture to someone else", situation: "you have to point at the exact byte where it went wrong" },
    ],
  },
  {
    id: "language",
    keywords: [
      "rust", "python", "javascript", "typescript", "golang", " go programming", "java ", "c++", "c#",
      "programming language", "syntax", "compiler", "interpreter", "type system", "kotlin", "swift",
    ],
    phases: [
      {
        title: "Language Fundamentals",
        summary: "The grammar and types the rest of the language is built on.",
        nodes: [
          {
            label: "syntax and grammar",
            description: (t) => `The shape ${t} expects code to take before it will even try to run it.`,
            insight: "Syntax errors are the cheapest bugs you'll ever fix. They're also where beginners get stuck longest.",
          },
          {
            label: "type system and semantics",
            description: (t) => `What ${t} actually guarantees about a value's type, and where those guarantees quietly stop.`,
            insight: "A type system that catches nothing at compile time is just documentation with extra steps.",
          },
          {
            label: "scope and binding rules",
            description: (t) => `How ${t} decides which name refers to which value at any given point in the code.`,
            insight: "Shadowing bugs are invisible in a diff and obvious in a debugger, which is exactly backwards from what you want.",
          },
        ],
      },
      {
        title: "Execution Model",
        summary: "What actually happens when the code you wrote turns into running behavior.",
        nodes: [
          {
            label: "memory management model",
            description: (t) => `Who owns a value in ${t}, and who is responsible for freeing it.`,
            insight: "Every memory model is a tradeoff between programmer effort and runtime cost, there's no free option.",
          },
          {
            label: "concurrency and parallelism primitives",
            description: (t) => `The building blocks ${t} gives you for running more than one thing at once, safely.`,
            insight: "Concurrency bugs don't show up in testing, they show up in production, under load, at 2am.",
          },
          {
            label: "compilation and execution pipeline",
            description: (t) => `The path ${t} source code takes from text file to running instructions.`,
            insight: "Understanding the pipeline is what lets you read an error message instead of just pattern-matching on it.",
          },
        ],
      },
      {
        title: "Ecosystem and Idiom",
        summary: "How practitioners who've shipped real things with this actually write it.",
        nodes: [
          {
            label: "standard library conventions",
            description: (t) => `The tools ${t} ships with by default, and the assumptions baked into how they're meant to be used.`,
            insight: "Reaching for a third-party library before checking the standard library is a tell, not a shortcut.",
          },
          {
            label: "tooling and build system",
            description: (t) => `How ${t} code actually gets compiled, packaged, and shipped, not just how it runs on your machine.`,
            insight: "The build system is where \"works on my machine\" goes to die.",
          },
          {
            label: "idiomatic patterns",
            description: (t) => `The patterns experienced ${t} developers reach for by default, and why the naive first approach usually isn't one of them.`,
            insight: "Idiom isn't style preference, it's accumulated scar tissue from bugs the language makes easy to write.",
          },
        ],
      },
    ],
    angles: [
      { angle: "under a tight deadline", situation: "the clock is the loudest voice in the room and shortcuts start looking reasonable" },
      { angle: "with a first-time contributor", situation: "someone touching the codebase for the first time, with no shared context" },
      { angle: "during a version upgrade", situation: "the language or a core dependency changes behavior out from under you" },
      { angle: "with an incomplete test suite", situation: "you can't fully trust that a change didn't break something else" },
      { angle: "in a performance-critical hot path", situation: "the idiomatic way and the fast way pull in different directions" },
      { angle: "when requirements change mid-flight", situation: "the target moves after you've already committed to a design" },
      { angle: "with incomplete documentation", situation: "the docs stop short of the part you actually need" },
      { angle: "during a live production incident", situation: "it's already broken and every fix has to be verified fast" },
      { angle: "reviewing someone else's pull request", situation: "you have to catch what's wrong without being the one who wrote it" },
      { angle: "teaching it to someone else", situation: "you have to make your reasoning legible, not just correct" },
    ],
  },
  {
    id: "process",
    keywords: [
      "agile", "scrum", "methodology", "project management", "workflow", "business process",
      "product strategy", "kanban", "product management",
    ],
    phases: [
      {
        title: "Structural Basics",
        summary: "Who does what, and on what rhythm.",
        nodes: [
          {
            label: "roles and responsibilities",
            description: (t) => `Who actually owns which decision in ${t}, and what happens when that's ambiguous.`,
            insight: "Ambiguous ownership doesn't cause conflict immediately. It causes silence, until something breaks.",
          },
          {
            label: "cadence and ceremony design",
            description: (t) => `The rhythm ${t} runs on, and what each recurring meeting is actually supposed to produce.`,
            insight: "A ceremony that doesn't produce a decision or an artifact is just a status update with extra steps.",
          },
          {
            label: "definition of done",
            description: (t) => `What actually counts as finished in ${t}, agreed on before the work starts, not after.`,
            insight: "Disagreements about \"done\" are really disagreements about scope that got deferred instead of resolved.",
          },
        ],
      },
      {
        title: "Execution Mechanics",
        summary: "How work actually gets prioritized, moved, and adjusted in flight.",
        nodes: [
          {
            label: "prioritization and tradeoff framework",
            description: (t) => `How ${t} actually decides what gets done first when everything is claimed to be important.`,
            insight: "A prioritization framework that always agrees with the loudest stakeholder isn't a framework, it's decoration.",
          },
          {
            label: "feedback loop design",
            description: (t) => `How fast ${t} surfaces that something is off course, and to whom.`,
            insight: "The value of a feedback loop is entirely in its latency. A correct signal that arrives too late is the same as no signal.",
          },
          {
            label: "scope and change management",
            description: (t) => `How ${t} absorbs a changed requirement without silently blowing up the timeline.`,
            insight: "Scope creep is rarely one big change. It's a dozen small \"just this one thing\" asks that nobody added up.",
          },
        ],
      },
      {
        title: "Organizational Reality",
        summary: "What happens once this has to work across more than one team.",
        nodes: [
          {
            label: "cross-team dependency handling",
            description: (t) => `How ${t} deals with work that depends on a team who doesn't share the same priorities.`,
            insight: "Cross-team dependencies fail silently, right up until the sprint where you actually needed the thing.",
          },
          {
            label: "scaling past one team",
            description: (t) => `What breaks in ${t} the moment it's not just one small, co-located team running it anymore.`,
            insight: "Most process breaks not because it was wrong, but because it was designed for a size that's since been outgrown.",
          },
          {
            label: "measuring whether it's actually working",
            description: (t) => `How you'd know if ${t} is genuinely helping, versus just being followed out of habit.`,
            insight: "\"We've always done it this way\" is not a metric. If you can't point to what it's improving, it's due for a hard look.",
          },
        ],
      },
    ],
    angles: [
      { angle: "under a hard external deadline", situation: "the date isn't moving no matter what the process says" },
      { angle: "with a newly formed team", situation: "nobody has shared context or trust built up yet" },
      { angle: "during a reorg", situation: "reporting lines and priorities are shifting mid-stream" },
      { angle: "when a key person is suddenly unavailable", situation: "the process assumed continuity that just broke" },
      { angle: "with conflicting stakeholder priorities", situation: "two people who both have real authority want different things" },
      { angle: "at 3x the usual team size", situation: "coordination overhead that was invisible before is now the bottleneck" },
      { angle: "after a failed initiative", situation: "trust in the process itself has taken a hit" },
      { angle: "explaining a missed deadline upward", situation: "you have to give the real reason without just assigning blame" },
      { angle: "with a remote-first team", situation: "the informal hallway alignment the process quietly relied on doesn't exist" },
      { angle: "handing the process off to a new lead", situation: "they need to run it without your accumulated context" },
    ],
  },
];

const GENERAL_CATEGORY: TopicCategory = {
  id: "general",
  keywords: [],
  phases: [
    {
      title: "Conceptual Foundations",
      summary: "The boundary and vocabulary everything else in this topic assumes you already have.",
      nodes: [
        {
          label: "scope and boundary",
          description: (t) => `What actually counts as part of ${t}, and what's a related-but-separate concern people often lump in by mistake.`,
          insight: "Half of expert disagreement on any topic is actually disagreement about where its boundary is.",
        },
        {
          label: "core vocabulary",
          description: (t) => `The handful of terms in ${t} that everything else gets built on, defined precisely instead of by example.`,
          insight: "Fuzzy vocabulary produces fuzzy reasoning. Precision here pays off everywhere downstream.",
        },
        {
          label: "why it exists",
          description: (t) => `The actual problem ${t} was created to solve, which explains most of its design decisions in hindsight.`,
          insight: "Understanding the original problem makes the design feel inevitable instead of arbitrary.",
        },
      ],
    },
    {
      title: "Mechanics in Practice",
      summary: "How the pieces actually fit together and interact under normal conditions.",
      nodes: [
        {
          label: "primary workflow end to end",
          description: (t) => `The path ${t} takes from a normal starting point to a normal successful outcome, with nothing going wrong.`,
          insight: "You can't recognize an abnormal path until you've walked the normal one enough times to feel automatic.",
        },
        {
          label: "common failure modes",
          description: (t) => `The specific ways ${t} tends to break in practice, not the theoretical ones from a textbook.`,
          insight: "The failure modes that actually happen are a short, boring list. The interesting-sounding ones almost never are the real risk.",
        },
        {
          label: "verification and correctness checks",
          description: (t) => `How you'd actually confirm ${t} did the right thing, rather than just assuming it did because nothing crashed.`,
          insight: "Absence of an error is not evidence of correctness. Most silent failures pass every naive check.",
        },
      ],
    },
    {
      title: "Judgment and Tradeoffs",
      summary: "Where the simple model breaks and what decisions real practitioners have to make.",
      nodes: [
        {
          label: "where the simple model breaks",
          description: (t) => `The specific edge where the beginner's mental model of ${t} stops matching reality.`,
          insight: "Everyone starts with the simple model. Expertise is mostly knowing exactly where it stops being true.",
        },
        {
          label: "tradeoffs practitioners actually face",
          description: (t) => `The real decision points in ${t} where there's no universally right answer, only a right answer for the context.`,
          insight: "If someone claims there's no tradeoff, they've usually just not hit the case where it bites yet.",
        },
        {
          label: "what separates competent from expert use",
          description: (t) => `The specific judgment call that experienced practitioners of ${t} make differently than someone who's only read about it.`,
          insight: "Expertise rarely looks like knowing more facts. It looks like knowing which fact matters right now.",
        },
      ],
    },
  ],
  angles: [
    { angle: "under peak load", situation: "load is spiking and queues start to build" },
    { angle: "with an unreliable network", situation: "packets drop or arrive out of order mid-exchange" },
    { angle: "during a partial rollout", situation: "only some nodes have the new behavior" },
    { angle: "when a downstream dependency degrades", situation: "something you depend on slows down or errors" },
    { angle: "with a first-time user", situation: "someone is touching it for the first time, with no context" },
    { angle: "under a tight deadline", situation: "the clock is the loudest voice in the room" },
    { angle: "when requirements change mid-flight", situation: "the target moves after you've already started" },
    { angle: "with incomplete documentation", situation: "the docs stop short of the part you actually need" },
    { angle: "during a live incident", situation: "it's already broken and people are watching" },
    { angle: "teaching it to someone else", situation: "you have to make your reasoning legible to someone else" },
  ],
};

function classifyTopic(topic: string): TopicCategory {
  const normalized = ` ${topic.toLowerCase()} `;
  for (const category of CATEGORIES) {
    if (category.keywords.some((kw) => normalized.includes(kw))) {
      return category;
    }
  }
  return GENERAL_CATEGORY;
}

export async function generateArchitectureMap(topic: string): Promise<ArchitectureMap> {
  await delay(NETWORK_DELAY_MS);

  const category = classifyTopic(topic);
  const now = new Date().toISOString();
  const phases = category.phases.map((template, i) => ({
    id: makeId("phase"),
    title: `Phase ${i + 1}: ${template.title}`,
    summary: template.summary,
  }));

  const nodes: ArchitectureMap["nodes"] = [];
  category.phases.forEach((template, phaseIndex) => {
    const phase = phases[phaseIndex];
    template.nodes.forEach((nodeTemplate, nodeIndex) => {
      const prevPhaseNodes = nodes.filter((n) => n.phaseId === phases[phaseIndex - 1]?.id);
      const prereqIds = phaseIndex === 0 ? [] : [prevPhaseNodes[nodeIndex % prevPhaseNodes.length]?.id].filter(
        (id): id is string => Boolean(id),
      );

      nodes.push({
        id: makeId("node"),
        phaseId: phase.id,
        label: `${topic}: ${nodeTemplate.label}`,
        description: nodeTemplate.description(topic),
        prereqIds,
        completed: false,
        completedAt: null,
      });
    });
  });

  return {
    id: makeId("map"),
    topic,
    slug: slugify(topic),
    phases,
    nodes,
    references: {},
    createdAt: now,
    updatedAt: now,
  };
}

export async function generateReferences(nodeLabel: string): Promise<NodeReference[]> {
  await delay(NETWORK_DELAY_MS);

  return [
    {
      title: `Primer: ${nodeLabel}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(nodeLabel)}+explained`,
      why: "Good starting point for the core vocabulary and mental model.",
    },
    {
      title: `${nodeLabel} in practice`,
      url: `https://www.google.com/search?q=${encodeURIComponent(nodeLabel)}+in+practice`,
      why: "Shows the concept applied to a real, worked example.",
    },
  ];
}

// --- Zenith reference: the idealized, expert-level shape of a topic ---
// Reuses the same per-category content as the architecture map, so the two stay
// thematically consistent instead of drawing from separate, unrelated templates.

export async function generateZenithReference(topic: string): Promise<ZenithReference> {
  await delay(NETWORK_DELAY_MS);

  const category = classifyTopic(topic);
  const nodes = category.phases.flatMap((template) =>
    template.nodes.map((nodeTemplate) => ({
      id: makeId("zenith"),
      phaseTitle: template.title,
      label: `${topic}: ${nodeTemplate.label}`,
      insight: nodeTemplate.insight,
    })),
  );

  return {
    topicSlug: slugify(topic),
    topic,
    tagline: "The reference shape, distilled.",
    nodes,
    generatedAt: new Date().toISOString(),
  };
}

// --- Implementations: 10 real-world application angles for a topic ---

export async function generateImplementations(topic: string): Promise<Implementation[]> {
  await delay(NETWORK_DELAY_MS);

  const category = classifyTopic(topic);
  const topicSlug = slugify(topic);
  return category.angles.map(({ angle, situation }) => ({
    id: makeId("impl"),
    topicSlug,
    title: `${topic}: ${angle}`,
    angle,
    blurb: `Practice applying ${topic} when ${situation}.`,
  }));
}

// --- Iterations: one factor-shaped practice rep + a 5-question check ---

const FACTOR_POOL = [
  "timeout budget cut in half",
  "one critical input field is missing",
  "no logs until after the fact",
  "someone is watching and asking questions",
  "half the usual time",
  "the obvious first approach is unavailable",
  "scale is 10x normal",
  "must explain reasoning out loud as you go",
];

export function generateIterationFactor(iterationIndex: number): string {
  const base = FACTOR_POOL[iterationIndex % FACTOR_POOL.length];
  const rep = Math.floor(iterationIndex / FACTOR_POOL.length);
  return rep === 0 ? base : `${base} (rep ${rep + 1})`;
}

export function buildIterationPractice(implementation: Implementation, factor: string): IterationPractice {
  return {
    prompt: `You're applying "${implementation.title}" and this rep adds: ${factor}. A decision point comes up right away.`,
    controlledFactors: ["You know the expected shape of a correct outcome", "You can still verify after the fact"],
    uncontrolledFactors: [`How exactly "${factor}" plays out`, "What else is competing for your attention right now"],
    choices: [
      {
        label: "Slow down, account for the factor, then act",
        consequence: "Takes a beat longer, but the factor doesn't blindside you.",
        warning: null,
        clean: true,
      },
      {
        label: "Act on instinct, adjust if something breaks",
        consequence: "Faster start, but the factor catches you mid-way and costs more to unwind.",
        warning: "Instinct without accounting for the factor is just the old pattern wearing a new situation.",
        clean: false,
      },
    ],
  };
}

const QUIZ_TEMPLATES: { prompt: (title: string, factor: string) => string; options: string[]; correctIndex: number }[] = [
  {
    prompt: (title, factor) => `What's the first move when "${factor}" shows up while applying ${title}?`,
    options: [
      "Check what the factor actually changes before acting",
      "Proceed exactly as planned and adjust if something breaks",
      "Wait for someone else to flag the issue",
      "Skip this step and come back to it later",
    ],
    correctIndex: 0,
  },
  {
    prompt: (_title, factor) => `Which signal best tells you "${factor}" is actually affecting the outcome, not just a coincidence?`,
    options: [
      "A guess based on how it usually goes",
      "A direct measurement or check tied to the factor itself",
      "Whether it feels urgent",
      "How long it's been since the last check",
    ],
    correctIndex: 1,
  },
  {
    prompt: (_title, factor) => `If "${factor}" makes the obvious approach risky, what's the sounder move?`,
    options: [
      "Force the obvious approach anyway to save time",
      "Abandon the task entirely",
      "Adjust the approach to account for the factor, then proceed",
      "Ask someone else to make the call without context",
    ],
    correctIndex: 2,
  },
  {
    prompt: (_title, factor) => `After acting under "${factor}", what actually confirms the practice held up?`,
    options: [
      "Assuming it worked because nothing broke immediately",
      "Verifying the specific outcome the factor put at risk",
      "Moving on immediately to the next rep",
      "Checking how it felt, not what happened",
    ],
    correctIndex: 1,
  },
  {
    prompt: (title) => `What's the real point of drilling ${title} more than once?`,
    options: [
      "To memorize one fixed script for one exact factor",
      "To build a reflex that adapts when the factor shows up differently next time",
      "To get a passing score on the quiz",
      "To finish the iterations as fast as possible",
    ],
    correctIndex: 1,
  },
];

export function buildQuiz(implementation: Implementation, factor: string): QuizQuestion[] {
  return QUIZ_TEMPLATES.map((template) => ({
    id: makeId("quiz"),
    prompt: template.prompt(implementation.title, factor),
    options: template.options,
    correctIndex: template.correctIndex,
  }));
}

export async function buildImplementationRun(
  implementation: Implementation,
  totalIterations: number,
): Promise<ImplementationRun> {
  await delay(NETWORK_DELAY_MS);

  const iterations: IterationState[] = Array.from({ length: totalIterations }, (_, index) => {
    const factor = generateIterationFactor(index);
    return {
      index,
      factor,
      practice: buildIterationPractice(implementation, factor),
      pickedLabel: null,
      practiceConsequence: null,
      practiceWarning: null,
      practiceClean: null,
      quiz: buildQuiz(implementation, factor),
      attempts: [],
      status: "pending",
    };
  });

  return {
    id: makeId("run"),
    implementation,
    totalIterations,
    iterations,
    currentIterationIndex: 0,
    finished: false,
    updatedAt: new Date().toISOString(),
  };
}
