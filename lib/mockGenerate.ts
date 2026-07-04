import { makeId, slugify } from "./id";
import { initialReinforcement } from "./spacedRepetition";
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
// a generic skeleton with the topic string swapped in. Every node carries
// separate what/why/how dimensions rather than one flat description, matching
// the same shape the real generation path (lib/realGenerate.ts) produces.

const NETWORK_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CategoryNode {
  label: string;
  what: (topic: string) => string;
  why: (topic: string) => string;
  how: (topic: string) => string;
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
            what: (t) => `What's actually valuable in ${t}, and every path an attacker could realistically use to reach it.`,
            why: () => "Because effort spent hardening things nobody would bother attacking is effort not spent on what actually gets hit.",
            how: () => "Walk the system from the outside in: enumerate every entry point, network, physical, human, then work backward to what each one can actually touch.",
            insight: "You can't defend what you haven't inventoried. Most breaches start in the part nobody mapped.",
          },
          {
            label: "threat modeling assumptions",
            what: (t) => `Who ${t} is actually being defended against, and what capability level that adversary realistically has.`,
            why: () => "Because the right level of defense depends entirely on who you're defending against, and guessing wrong wastes effort in both directions.",
            how: () => "Name a specific adversary with specific capabilities and specific motives, then size defenses to that adversary, not to an abstract attacker.",
            insight: "Defending against a nation-state and defending against opportunistic scanning require different tradeoffs. Conflating them wastes effort in both directions.",
          },
          {
            label: "trust boundary identification",
            what: (t) => `Where ${t} stops trusting input and starts verifying it, explicitly.`,
            why: () => "Because every place two components meet without an explicit trust decision is a place validation silently falls through the cracks.",
            how: () => "Draw the system as boxes and arrows, mark every arrow crossing from less-trusted to more-trusted, and that's where validation has to live.",
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
            what: (t) => `How ${t} confirms who's on the other end, and keeps that confirmation from being hijacked mid-session.`,
            why: () => "Because confirming identity once at login and never again leaves the entire rest of the session available to whoever steals the token.",
            how: () => "Bind sessions to something an attacker can't trivially replay, short expiry, rotation, device signals, and revoke on the signals that actually indicate compromise.",
            insight: "A strong login and a weak session token is still a broken system, just a slower one to break.",
          },
          {
            label: "encryption and key management",
            what: (t) => `How ${t} keeps data unreadable to everyone except the intended recipient, and how it manages the keys that make that true.`,
            why: () => "Because encrypted data sitting next to its own key in the same blast radius isn't actually protected, it just looks protected.",
            how: () => "Separate where keys live from where encrypted data lives, rotate them on a schedule, and make sure losing one machine doesn't mean losing the key too.",
            insight: "Encryption with poor key management is theater. The algorithm was never the weak point.",
          },
          {
            label: "input validation and boundary enforcement",
            what: (t) => `How ${t} treats every piece of external input as hostile until proven otherwise.`,
            why: () => "Because the one input you didn't validate is the one an attacker will find, and it only takes one.",
            how: () => "Validate at the boundary, on the way in, against an explicit allow-list of what's valid, not a blocklist of what you've thought of so far.",
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
            what: (t) => `What you actually do the moment you find out ${t} is being actively exploited, in order, without making it worse.`,
            why: () => "Because the instinct to fix it immediately competes directly with the need to understand what happened, and getting that order wrong costs you both.",
            how: () => "Contain first without destroying evidence, capture state before touching anything, then remediate in a sequence you can explain afterward.",
            insight: "The instinct to immediately patch live can destroy the evidence you need to know what actually happened.",
          },
          {
            label: "patch and disclosure tradeoffs",
            what: (t) => `How fast ${t} can realistically be patched, and who needs to know before that patch ships.`,
            why: () => "Because a rushed fix that breaks something else trades one incident for another, and who you tell determines how much damage happens while you're still working.",
            how: () => "Test the patch against the same conditions that triggered the bug before shipping it live, and loop people in on a timeline tied to actual risk.",
            insight: "A rushed patch that breaks production is its own incident. Speed and correctness are in real tension here.",
          },
          {
            label: "post-incident hardening",
            what: (t) => `What actually changes in ${t} after an incident, versus what just gets a retrospective doc nobody rereads.`,
            why: () => "Because a retrospective document nobody rereads doesn't stop the same failure from happening again the same way.",
            how: () => "Turn the root cause into a specific, testable change, a check, a control, an alert, and verify it actually fires before calling the incident closed.",
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
            what: (t) => `Where the data behind ${t} actually comes from, and what bias or gap got baked in before anyone touched a model.`,
            why: () => "Because a model trained on wrong labels will confidently learn the wrong thing, and no amount of tuning afterward fixes that.",
            how: () => "Audit a sample of labels by hand against ground truth before trusting the pipeline, and track inter-labeler agreement as an actual metric.",
            insight: "A model can't be more correct than the labels it was trained on. Garbage labels are a silent ceiling on quality.",
          },
          {
            label: "feature representation",
            what: (t) => `How raw signal gets turned into something ${t} can actually learn from.`,
            why: () => "Because the model can only find patterns the representation makes visible; hide the signal in the wrong encoding and no model complexity recovers it.",
            how: () => "Start from what a domain expert would actually look at to make the same judgment, and encode that, not whatever raw fields were easiest to pull.",
            insight: "The right representation makes an easy problem out of a hard one. The wrong one makes an impossible problem out of an easy one.",
          },
          {
            label: "data drift and staleness",
            what: (t) => `How the real-world data ${t} sees in production quietly stops matching what it was trained on.`,
            why: () => "Because the world the model was trained on keeps moving, and a model with no eyes on that movement just gets quietly wrong.",
            how: () => "Track the statistical shape of production inputs against the training distribution continuously, and alert on the shift itself, not just downstream accuracy.",
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
            what: (t) => `The actual loop ${t} runs to get from random weights to something useful.`,
            why: () => "Because most of what looks like a model problem is actually a data-feeding problem, and you can't tell the difference without watching the loop itself.",
            how: () => "Instrument the loop to log what data actually went in each step, not just the loss curve, so a silent feeding bug surfaces before it wastes a full run.",
            insight: "Most training bugs aren't in the model, they're in the loop feeding it data wrong without erroring.",
          },
          {
            label: "evaluation and generalization",
            what: (t) => `How you know ${t} actually learned the pattern, instead of just memorizing the training set.`,
            why: () => "Because a model that memorizes its training set looks perfect right up until it meets the real world.",
            how: () => "Hold out data the model has genuinely never seen, including anything correlated with the training set, and evaluate on that alone.",
            insight: "A model that aces its test set and fails in production usually leaked test data into training somewhere.",
          },
          {
            label: "model selection tradeoffs",
            what: (t) => `What you're actually trading away by picking a simpler or more complex approach for ${t}.`,
            why: () => "Because every extra point of accuracy from a fancier model costs something in latency, cost, or interpretability, and that cost is real even unwritten.",
            how: () => "Name the actual constraint, latency budget, cost ceiling, need to explain a decision, before picking a model, then pick the simplest one that clears it.",
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
            what: (t) => `How you'd actually notice ${t} degrading in production before a user complains about it.`,
            why: () => "Because a support ticket is the slowest, most expensive way to find out a model degraded.",
            how: () => "Monitor the model's own output distribution and confidence, not just business metrics, so degradation shows up before a customer notices.",
            insight: "If your only feedback signal is a support ticket, you don't have monitoring, you have a lagging indicator.",
          },
          {
            label: "inference cost and latency budget",
            what: (t) => `What it actually costs, in time and money, to get a prediction out of ${t} at the volume you need.`,
            why: () => "Because an accuracy gain nobody asked for still has to be paid for at the volume you actually serve.",
            how: () => "Measure cost per prediction at real production volume before shipping an upgrade, and require an explicit tradeoff decision if it moves.",
            insight: "An accuracy gain that doubles inference cost isn't automatically worth it. Someone has to say no to it explicitly.",
          },
          {
            label: "failure mode and fallback behavior",
            what: (t) => `What ${t} does when it's uncertain or wrong, and whether that failure is graceful or silent.`,
            why: () => "Because a confidently wrong answer does more damage than an honest \"I don't know,\" but only the second one is a design choice most teams actually make.",
            how: () => "Build an explicit low-confidence path, defer, flag, fall back to a simpler rule, instead of letting every prediction go out with equal confidence.",
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
            what: (t) => `How ${t} carves up CPU, memory, and I/O between competing units of work.`,
            why: () => "Because resource limits that look fine in isolation get adversarial fast the moment multiple things actually compete for them at once.",
            how: () => "Set limits based on worst-case contention, not average usage, and test what happens when two greedy workloads land on the same node together.",
            insight: "Resource limits that look generous in isolation get adversarial fast once things actually contend for them.",
          },
          {
            label: "scheduling and concurrency",
            what: (t) => `How ${t} decides what runs next, and what a unit of work is guaranteed about fairness and ordering.`,
            why: () => "Because average fairness hides the specific workload that's being starved every single time, and that workload is someone's actual job.",
            how: () => "Check tail latency per workload class, not just the aggregate, and give starvation-prone workloads an explicit floor.",
            insight: "A scheduler that's fair on average can still starve a specific workload forever.",
          },
          {
            label: "storage and persistence layer",
            what: (t) => `How ${t} makes sure data survives a crash, and what "durable" actually means once you read the fine print.`,
            why: () => "Because durable is a claim made by the weakest layer underneath it, and that layer is usually further down the stack than anyone checked.",
            how: () => "Trace a write all the way to physical disk and confirm what happens if power is cut at each stage, not just what the API promises.",
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
            what: (t) => `How ${t} keeps multiple copies of the same data in agreement, even when messages get lost or delayed.`,
            why: () => "Because skipping consensus to save latency is a bet that the failure it protects against won't happen on your watch, and that bet isn't free.",
            how: () => "Decide explicitly, in writing, what consistency guarantee you actually need before choosing a replication strategy.",
            insight: "Consensus is expensive by design. The systems that skip it are making a bet, whether they admit it or not.",
          },
          {
            label: "failure detection and recovery",
            what: (t) => `How ${t} tells the difference between a slow node and a dead one, and what it does about either.`,
            why: () => "Because you cannot reliably distinguish slow from dead over a network, and every system picks a timeout and lives with being wrong sometimes.",
            how: () => "Pick a timeout based on the real cost of a false positive versus a false negative for this specific system, not a copied default.",
            insight: "You cannot reliably distinguish \"slow\" from \"dead\" over a network. Every system picks a timeout and lives with being wrong sometimes.",
          },
          {
            label: "partitioning and load distribution",
            what: (t) => `How ${t} spreads work and data across nodes so no single one becomes the bottleneck.`,
            why: () => "Because an even hash distribution on paper still produces hot keys the moment real traffic isn't uniform, and it never is.",
            how: () => "Instrument actual key access patterns in production and rebalance around observed hot keys, not theoretical even distribution.",
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
            what: (t) => `How you know ${t} needs more resources before it's already too late.`,
            why: () => "Because by the time the alert fires you're usually already behind, and good capacity planning is boring specifically because it happens before that.",
            how: () => "Track leading indicators, growth rate, saturation trend, and set scaling triggers ahead of the threshold that actually hurts, not at it.",
            insight: "By the time the alert fires, you're usually already behind. Good capacity planning is boring, which is the point.",
          },
          {
            label: "upgrade and rollback strategy",
            what: (t) => `How you change a running ${t} deployment without taking it down, and how you undo it if it goes wrong.`,
            why: () => "Because an untested rollback isn't a rollback plan, it's a hope, and hope is not a strategy under pressure.",
            how: () => "Actually execute the rollback path in a non-production environment before you need it for real, on the same version skew you'd hit live.",
            insight: "If you haven't tested the rollback, you don't have a rollback plan, you have a hope.",
          },
          {
            label: "incident diagnosis playbook",
            what: (t) => `The order of checks that gets you from "something's wrong with ${t}" to the actual root cause, fast.`,
            why: () => "Because under pressure people default to the checks they've memorized, not the ones actually relevant to this specific failure.",
            how: () => "Write the diagnosis order down in advance, ranked by how often each check has actually found the root cause historically, not by instinct.",
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
            what: (t) => `How ${t} decides where one message ends and the next begins, and what breaks if that boundary is read wrong.`,
            why: () => "Because a framing bug doesn't fail loudly, it silently misreads the next message, and every layer built on top inherits that corruption.",
            how: () => "Use an explicit length prefix or delimiter the receiver can't misinterpret, and test the boundary case where a message splits exactly at that marker.",
            insight: "Get the framing wrong and every layer built on top inherits a silent corruption bug.",
          },
          {
            label: "connection establishment and lifecycle",
            what: (t) => `The sequence ${t} uses to go from nothing to a live, trusted channel, and how it tears that channel down cleanly.`,
            why: () => "Because most implementations get tested on the happy path and never on the teardown, which is exactly where the bugs hide.",
            how: () => "Explicitly test abrupt disconnects and half-closed connections, not just the clean open-and-close sequence.",
            insight: "Most implementations nail the happy path and never test the teardown.",
          },
          {
            label: "addressing and endpoint identity",
            what: (t) => `How ${t} names the two sides of a conversation so a message actually reaches the right place.`,
            why: () => "Because identity and location get conflated constantly, and that conflation is exactly where routing bugs live.",
            how: () => "Keep who this is and where this is right now as separate concepts in the design, even when they're usually the same value.",
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
            what: (t) => `How ${t} knows a message actually arrived, and what it does when it doesn't hear back in time.`,
            why: () => "Because a retry policy with no backoff turns a transient blip into a self-inflicted denial of service.",
            how: () => "Use exponential backoff with jitter, and cap total retries against a budget the caller actually agreed to.",
            insight: "A retry policy with no backoff is just a self-inflicted denial of service.",
          },
          {
            label: "flow control and backpressure",
            what: (t) => `How ${t} keeps a fast sender from drowning a slow receiver.`,
            why: () => "Because the real failure mode isn't a crash, it's a slow, invisible queue that nobody notices building until it's already too late.",
            how: () => "Make queue depth an explicit, monitored number, and apply backpressure to the sender before that queue becomes the bottleneck.",
            insight: "The failure mode is rarely a crash, it's a slow, invisible queue that nobody notices until it's too late.",
          },
          {
            label: "ordering and sequencing guarantees",
            what: (t) => `What ${t} promises about the order messages arrive in, and what happens the moment that promise is violated.`,
            why: () => "Because out-of-order delivery is the default over any real network, not a rare exception, and code that assumes order will eventually be wrong.",
            how: () => "Attach sequence numbers explicitly and reorder or reject at the receiver, rather than trusting arrival order.",
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
            what: (t) => `How firewalls, proxies, and NAT devices reshape ${t} in transit, often in ways the spec never anticipated.`,
            why: () => "Because the spec describes two endpoints, but production has several boxes in between, each quietly rewriting or blocking things the spec never anticipated.",
            how: () => "Test through an actual NAT, firewall, or proxy chain representative of production, not just endpoint to endpoint on a clean network.",
            insight: "The spec describes two endpoints. Production has five boxes in between, each with an opinion.",
          },
          {
            label: "security and encryption layering",
            what: (t) => `Where encryption gets bolted onto ${t}, and what it costs in latency and complexity to do it right.`,
            why: () => "Because bolting encryption on after the protocol is designed is exactly how downgrade attacks get discovered later by someone else.",
            how: () => "Design the encryption handshake as part of the protocol from the start, with no unauthenticated fallback path an attacker can force.",
            insight: "Bolting security on after the fact is how you end up with a downgrade attack nobody planned for.",
          },
          {
            label: "observability and failure diagnosis",
            what: (t) => `What you actually need visible to tell why a specific ${t} exchange failed, days after the fact.`,
            why: () => "Because if you can't reconstruct what happened from the logs days later, you don't actually understand the system, you're guessing.",
            how: () => "Log enough at each hop, timestamps, connection IDs, key state transitions, to reconstruct a single exchange's full path after the fact.",
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
            what: (t) => `The shape ${t} expects code to take before it will even try to run it.`,
            why: () => "Because syntax errors are the cheapest bugs to fix, but only if you understand what the parser actually expects instead of pattern-matching past it.",
            how: () => "Read the actual error location and expected token, not just the first line of the error message, before guessing at a fix.",
            insight: "Syntax errors are the cheapest bugs you'll ever fix. They're also where beginners get stuck longest.",
          },
          {
            label: "type system and semantics",
            what: (t) => `What ${t} actually guarantees about a value's type, and where those guarantees quietly stop.`,
            why: () => "Because a type system that catches nothing at compile time is documentation with extra steps, and knowing which one you have changes how much to trust it.",
            how: () => "Deliberately write a program that should fail to compile if the type system is doing real work, and confirm it actually does.",
            insight: "A type system that catches nothing at compile time is just documentation with extra steps.",
          },
          {
            label: "scope and binding rules",
            what: (t) => `How ${t} decides which name refers to which value at any given point in the code.`,
            why: () => "Because a shadowing bug is invisible in a diff and obvious in a debugger, which is exactly backwards from when you'd want to catch it.",
            how: () => "Trace which binding a name resolves to at the specific line in question, not just where it was declared nearest to.",
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
            what: (t) => `Who owns a value in ${t}, and who is responsible for freeing it.`,
            why: () => "Because every memory model trades programmer effort for runtime cost somewhere, and not knowing where means hitting that cost by surprise.",
            how: () => "Trace who allocates a value and who is responsible for freeing it for a specific real data structure in the codebase, not in the abstract.",
            insight: "Every memory model is a tradeoff between programmer effort and runtime cost, there's no free option.",
          },
          {
            label: "concurrency and parallelism primitives",
            what: (t) => `The building blocks ${t} gives you for running more than one thing at once, safely.`,
            why: () => "Because concurrency bugs don't show up in testing, they show up in production, under load, usually at the worst time.",
            how: () => "Deliberately run the concurrent path under contention, more threads than cores, artificial delays, before trusting it.",
            insight: "Concurrency bugs don't show up in testing, they show up in production, under load, at 2am.",
          },
          {
            label: "compilation and execution pipeline",
            what: (t) => `The path ${t} source code takes from text file to running instructions.`,
            why: () => "Because understanding the pipeline is what lets you read an error message instead of pattern-matching on it.",
            how: () => "Trace one real piece of source code through each stage of the pipeline by hand at least once, so the stages stop being abstract.",
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
            what: (t) => `The tools ${t} ships with by default, and the assumptions baked into how they're meant to be used.`,
            why: () => "Because reaching for a third-party library before checking the standard library is usually a tell that you don't yet know what's already there.",
            how: () => "Check the standard library's own solution to a problem before adding a dependency for it, and only add the dependency if it's genuinely insufficient.",
            insight: "Reaching for a third-party library before checking the standard library is a tell, not a shortcut.",
          },
          {
            label: "tooling and build system",
            what: (t) => `How ${t} code actually gets compiled, packaged, and shipped, not just how it runs on your machine.`,
            why: () => "Because the build system is where works on my machine goes to die, and understanding it is what prevents that.",
            how: () => "Reproduce the exact build a CI system runs, locally, rather than trusting your local environment matches it.",
            insight: "The build system is where \"works on my machine\" goes to die.",
          },
          {
            label: "idiomatic patterns",
            what: (t) => `The patterns experienced ${t} developers reach for by default, and why the naive first approach usually isn't one of them.`,
            why: () => "Because idiom isn't style preference, it's accumulated scar tissue from bugs the language makes easy to write, and skipping it means rediscovering them yourself.",
            how: () => "When the naive first approach seems too easy for a problem this common, check what experienced practitioners actually do instead, and ask why.",
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
            what: (t) => `Who actually owns which decision in ${t}, and what happens when that's ambiguous.`,
            why: () => "Because ambiguous ownership doesn't cause conflict immediately, it causes silence, right up until something breaks and everyone assumed someone else had it.",
            how: () => "Name one explicit owner per decision type in writing, even when it feels obvious, so the ambiguity is resolved before it's tested.",
            insight: "Ambiguous ownership doesn't cause conflict immediately. It causes silence, until something breaks.",
          },
          {
            label: "cadence and ceremony design",
            what: (t) => `The rhythm ${t} runs on, and what each recurring meeting is actually supposed to produce.`,
            why: () => "Because a ceremony that doesn't produce a decision or an artifact is just a status update with extra steps.",
            how: () => "For each recurring meeting, name the specific decision or artifact it's supposed to produce, and cut it if it consistently doesn't.",
            insight: "A ceremony that doesn't produce a decision or an artifact is just a status update with extra steps.",
          },
          {
            label: "definition of done",
            what: (t) => `What actually counts as finished in ${t}, agreed on before the work starts, not after.`,
            why: () => "Because disagreements about done are really disagreements about scope that got deferred instead of resolved.",
            how: () => "Write the specific, checkable criteria for done before the work starts, not after someone claims it's finished.",
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
            what: (t) => `How ${t} actually decides what gets done first when everything is claimed to be important.`,
            why: () => "Because a prioritization framework that always agrees with the loudest stakeholder isn't a framework, it's decoration.",
            how: () => "Apply the same explicit criteria to every request regardless of who's asking, and be willing to say no using it.",
            insight: "A prioritization framework that always agrees with the loudest stakeholder isn't a framework, it's decoration.",
          },
          {
            label: "feedback loop design",
            what: (t) => `How fast ${t} surfaces that something is off course, and to whom.`,
            why: () => "Because the value of a feedback loop is entirely in its latency; a correct signal that arrives too late is the same as no signal.",
            how: () => "Measure the actual time from something went off course to someone who can act on it finds out, and shorten that specifically.",
            insight: "The value of a feedback loop is entirely in its latency. A correct signal that arrives too late is the same as no signal.",
          },
          {
            label: "scope and change management",
            what: (t) => `How ${t} absorbs a changed requirement without silently blowing up the timeline.`,
            why: () => "Because scope creep is rarely one big change, it's a dozen small just this one thing asks that nobody added up.",
            how: () => "Log every scope addition against the original estimate explicitly, so the accumulation is visible before it blows the timeline.",
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
            what: (t) => `How ${t} deals with work that depends on a team who doesn't share the same priorities.`,
            why: () => "Because cross-team dependencies fail silently, right up until the sprint where you actually needed the thing and it wasn't there.",
            how: () => "Surface cross-team asks explicitly and early, with a named owner on the other side, instead of assuming it'll get done because it was mentioned once.",
            insight: "Cross-team dependencies fail silently, right up until the sprint where you actually needed the thing.",
          },
          {
            label: "scaling past one team",
            what: (t) => `What breaks in ${t} the moment it's not just one small, co-located team running it anymore.`,
            why: () => "Because most process breaks not because it was wrong, but because it was sized for a team that's since been outgrown.",
            how: () => "Revisit the process explicitly at known size thresholds, not just when it visibly breaks, and adjust it ahead of the pain.",
            insight: "Most process breaks not because it was wrong, but because it was designed for a size that's since been outgrown.",
          },
          {
            label: "measuring whether it's actually working",
            what: (t) => `How you'd know if ${t} is genuinely helping, versus just being followed out of habit.`,
            why: () => "Because we've always done it this way is not a metric, and a process that can't point to what it's improving is due for a hard look.",
            how: () => "Pick one concrete outcome the process is supposed to improve, measure it before and after, and be willing to change the process if it doesn't move.",
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
          what: (t) => `What actually counts as part of ${t}, and what's a related-but-separate concern people often lump in by mistake.`,
          why: () => "Because half of expert disagreement on any topic is actually disagreement about where its boundary is, not the substance inside it.",
          how: () => "State explicitly what counts and what doesn't before going deeper, and check that definition against a genuinely edge-case example.",
          insight: "Half of expert disagreement on any topic is actually disagreement about where its boundary is.",
        },
        {
          label: "core vocabulary",
          what: (t) => `The handful of terms in ${t} that everything else gets built on, defined precisely instead of by example.`,
          why: () => "Because fuzzy vocabulary produces fuzzy reasoning, and that cost compounds at every step built on top of it.",
          how: () => "Define each core term precisely enough that you could explain it to someone with zero context, not just by pointing at an example.",
          insight: "Fuzzy vocabulary produces fuzzy reasoning. Precision here pays off everywhere downstream.",
        },
        {
          label: "why it exists",
          what: (t) => `The actual problem ${t} was created to solve, which explains most of its design decisions in hindsight.`,
          why: () => "Because understanding the original problem is what makes the design feel inevitable instead of arbitrary, which is what lets you extend it correctly.",
          how: () => "Trace the design back to the specific problem it was built to solve, and check which decisions stop making sense if that problem is removed.",
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
          what: (t) => `The path ${t} takes from a normal starting point to a normal successful outcome, with nothing going wrong.`,
          why: () => "Because you can't recognize an abnormal path until you've walked the normal one enough times that it feels automatic.",
          how: () => "Walk the full workflow start to finish at least once without skipping steps, even the ones that seem obvious.",
          insight: "You can't recognize an abnormal path until you've walked the normal one enough times to feel automatic.",
        },
        {
          label: "common failure modes",
          what: (t) => `The specific ways ${t} tends to break in practice, not the theoretical ones from a textbook.`,
          why: () => "Because the failure modes that actually happen are a short, boring list, and the interesting-sounding ones almost never are the real risk.",
          how: () => "Collect the failures that have actually occurred, not hypothetical ones, and rank effort spent preventing them by actual frequency.",
          insight: "The failure modes that actually happen are a short, boring list. The interesting-sounding ones almost never are the real risk.",
        },
        {
          label: "verification and correctness checks",
          what: (t) => `How you'd actually confirm ${t} did the right thing, rather than just assuming it did because nothing crashed.`,
          why: () => "Because absence of an error is not evidence of correctness, and most silent failures pass every naive check.",
          how: () => "Check the actual output against an independent expectation, not just whether the process completed without visibly crashing.",
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
          what: (t) => `The specific edge where the beginner's mental model of ${t} stops matching reality.`,
          why: () => "Because everyone starts with the simple model, and expertise is mostly knowing exactly where it stops being true.",
          how: () => "Deliberately push the simple model to its edge case and observe exactly where it stops predicting reality correctly.",
          insight: "Everyone starts with the simple model. Expertise is mostly knowing exactly where it stops being true.",
        },
        {
          label: "tradeoffs practitioners actually face",
          what: (t) => `The real decision points in ${t} where there's no universally right answer, only a right answer for the context.`,
          why: () => "Because if someone claims there's no tradeoff, they've usually just not hit the case where it bites yet.",
          how: () => "Name the specific competing goals in a real decision point, and make the tradeoff explicit instead of pretending one option is free.",
          insight: "If someone claims there's no tradeoff, they've usually just not hit the case where it bites yet.",
        },
        {
          label: "what separates competent from expert use",
          what: (t) => `The specific judgment call that experienced practitioners of ${t} make differently than someone who's only read about it.`,
          why: () => "Because expertise rarely looks like knowing more facts, it looks like knowing which fact matters right now.",
          how: () => "Watch or ask an experienced practitioner what they check first in an ambiguous situation, and compare it to what a beginner would check first.",
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

// Node labels stand alone as headings now (no mechanical "${topic}: " prefix),
// but the category content below was written lowercase to follow that old
// prefix, so capitalize on the way out.
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function generateArchitectureMap(topic: string): Promise<ArchitectureMap> {
  await delay(NETWORK_DELAY_MS);

  const category = classifyTopic(topic);
  const now = new Date().toISOString();
  const phases = category.phases.map((template, i) => ({
    id: makeId("phase"),
    title: `Phase ${i + 1}: ${template.title}`,
    summary: template.summary,
    notes: [],
  }));

  const nodes: ArchitectureMap["nodes"] = [];
  category.phases.forEach((template, phaseIndex) => {
    const phase = phases[phaseIndex];
    template.nodes.forEach((nodeTemplate, nodeIndex) => {
      const prevPhaseNodes = nodes.filter((n) => n.phaseId === phases[phaseIndex - 1]?.id);
      const prereqNode = phaseIndex === 0 ? undefined : prevPhaseNodes[nodeIndex % prevPhaseNodes.length];
      const prereqIds = prereqNode ? [prereqNode.id] : [];

      nodes.push({
        id: makeId("node"),
        phaseId: phase.id,
        label: capitalize(nodeTemplate.label),
        what: nodeTemplate.what(topic),
        why: nodeTemplate.why(topic),
        how: nodeTemplate.how(topic),
        equation: "",
        connection: prereqNode
          ? `Assumes "${prereqNode.label}" is already solid before this goes further.`
          : `A load bearing starting point, nothing in ${topic} precedes it.`,
        prereqIds,
        completed: false,
        completedAt: null,
        notes: [],
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
      label: capitalize(nodeTemplate.label),
      how: nodeTemplate.how(topic),
      equation: "",
      insight: nodeTemplate.insight,
      notes: [],
      reinforcement: initialReinforcement(),
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
