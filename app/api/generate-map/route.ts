import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ARCHITECT_PERSONA_PROMPT } from "@/lib/prompts";

// Server only. The API key never reaches the browser. Falls back to the
// deterministic mock generator (see lib/mockGenerate.ts) whenever this route
// is unavailable, unconfigured, or errors, so the app always works even with
// no key set.
export const runtime = "nodejs";

const MAP_SCHEMA = {
  type: "object",
  properties: {
    tagline: { type: "string" },
    phases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                dependsOn: { type: "array", items: { type: "string" } },
                what: { type: "string" },
                why: { type: "string" },
                how: { type: "string" },
                equation: { type: "string" },
                connection: { type: "string" },
                structure: { type: "string" },
                behavior: { type: "string" },
                marketImplementation: { type: "string" },
                insight: { type: "string" },
              },
              required: [
                "label",
                "dependsOn",
                "what",
                "why",
                "how",
                "equation",
                "connection",
                "structure",
                "behavior",
                "marketImplementation",
                "insight",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "summary", "nodes"],
        additionalProperties: false,
      },
    },
  },
  required: ["tagline", "phases"],
  additionalProperties: false,
} as const;

const USER_PROMPT_TEMPLATE = (topic: string, context: string) => `Raw topic input from a learner: "${topic}"
${context ? `\nThe learner also answered clarifying questions before this map was built. Use these answers to shape the map, they are load bearing context, not decoration:\n${context}\n` : ""}
This is raw input, not a label to echo back. It may be casual, shorthand, imprecise, or oddly phrased. Interpret what they actually mean and which real field of knowledge or practice this is, then build the map for that real subject. Never quote or repeat the raw input string back verbatim anywhere in your output, not in a phase title, not in a node label, not in any field. Every string you produce must read as if a domain expert wrote it from scratch, with zero trace of the literal input phrasing.

Produce exactly 4 phases, each with 3 subtopics ("nodes"). The 4 phases are a genuine depth ladder, and each rung is a different relationship to the material, not just "more facts": phase 1 is the load bearing theory, the concepts and laws stated with full precision, exactly as true whether or not anyone ever builds anything from them. Phase 2 is that theory turned into real practice, the actual techniques, procedures, and tools a working practitioner uses to make it real, and the map must earn the turn from phase 1 to phase 2, a reader should feel why the theory demands these specific practices. Phase 3 is the tradeoffs, edge cases, and failure modes visible only once you've actually practiced it, the judgment that separates competent from expert. Phase 4 is the frontier: open problems, active research, or a genuine invention or innovation still being fought over in the field, not a settled recap wearing a fancier label. Do not pad a shallow topic to fake four levels of depth, and do not flatten a genuinely deep topic, calibrate honestly to how deep this specific subject actually goes.

Write this for a reader who could be a working scientist or senior practitioner in the field. Every sentence has to earn its place against that reader specifically: if it's the kind of line that would make them nod because it's exactly the real mechanism, keep it; if it's the kind of line that would make them wince because it's a warmed over platitude a textbook would say about any subject, cut it and write the actual specific thing instead.

The whole arc across the 4 phases has exactly one job by the end: leave the reader actually ready to go implement, build, or experiment for real, not merely able to describe the topic. Phase 4 in particular should make explicit, through its content, what a person would still need to nail down to attempt the real thing at that frontier level.

Each phase's "title" must be a short, specific name for that stage and its actual content, never a generic label like "Foundations" or "Advanced Topics", and never the subject's own name restated.

Each node's "label" is a 3 to 6 word subtopic name that stands completely on its own as a heading, properly capitalized, specific to this exact subtopic. It must make sense read in isolation, with no dependency on being prefixed by the topic name, because it will be displayed without one. Every label across the whole map must be unique, exact string, because later nodes reference earlier ones by this exact string.

Each node needs a "dependsOn" field: an array of the EXACT label strings of specific earlier-phase nodes this node genuinely, logically requires as a prerequisite, not a positional guess, not "the node above it", an actual conceptual dependency you can justify. Phase 1 nodes must have an empty dependsOn array, nothing precedes them. A phase 2, 3, or 4 node usually depends on one or two specific earlier nodes, occasionally more if genuinely true, never depends on something in its own phase or a later phase, and never lists a label that does not exactly match an earlier node's label. If a node in phase 3 or 4 is honestly a direct continuation of just one earlier node, say so with exactly one entry, do not pad the list.

For each node, fill in these fields:
- "what": precisely what this concept, mechanism, or procedure IS, one to two sentences. A concrete definition a domain expert would recognize as accurate, not a vague gesture at a category.
- "why": the actual causal reason this matters or is built this way, one to two sentences. Not a platitude like "this is important because it helps." Say what specifically breaks, costs, or fails if this is missing or wrong.
- "how": the actual mechanism, procedure, or technique, one to two sentences, spelled out concretely enough that a practitioner could act on it. Use real numbers, named techniques, tools, or steps wherever the subject actually has them. This is the field that must not be generic verbiage.
- "equation": if this specific subtopic has a real, named equation, formula, quantitative relationship, or exact algorithmic step that a practitioner would actually write down or compute, put it here in clean plain notation (e.g. "F = ma", "P(A|B) = P(B|A)P(A) / P(B)", using unicode for exponents, subscripts, and greek letters where natural). If this subtopic is genuinely not the kind of thing that has a formula, an interpersonal or judgment-based subtopic for instance, leave this as an empty string, do not invent a fake equation just to fill the field.
- "connection": one sentence making the logical thread explicit and specific, never generic. If dependsOn is non-empty, say concretely what breaks or becomes impossible in THIS node without the specific thing it depends on, so the link is causal, not sequencing dressed up as logic. If dependsOn is empty (a phase 1 node), say what larger question this node's foundation opens up later in the field, not "this is a fundamental concept."
- "structure": what this concept is actually composed of and how those parts connect to each other, one to two sentences. This is the "what is it built from" view: the components, layers, or elements and their relationship to one another. Distinct from "what", which defines the concept; this describes its internal architecture.
- "behavior": how this concept actually operates or behaves once it's running, in motion, under real conditions, one to two sentences. This is the "what does it actually do in real time" view: the dynamics, the sequence of events, the observable runtime behavior. Distinct from "how", which is the practitioner's procedure; this is the thing's own operation once set in motion.
- "marketImplementation": name ONE specific, real, currently existing product, company, platform, or deployed system that is genuinely among the most advanced or promising real-world applications of this exact subtopic right now, to the best of your knowledge. Be concretely specific and named, never a generic category like "a cloud provider" or "modern smartphones". If you are not genuinely confident of a specific, real, current example for this exact subtopic, or naming one would just be a plausible-sounding guess, say so honestly in this field instead of inventing a fake name, for instance "no single named implementation stands out here, this is still primarily research/theory" is a legitimate answer. Flag explicitly if your knowledge of what's current may be dated.
- "insight": one sharp, senior practitioner or working scientist level sentence, the kind of thing that separates someone who has actually done this for real from someone who has only read about it. This is the line that should make a real expert in the field feel this was written by one of their own, not by someone summarizing the subject from outside it.

Also produce a top level "tagline": one sharp sentence capturing what true mastery of this specific subject actually looks like at its ceiling, the aspirational endpoint this whole map builds toward. Specific to this subject, never a generic phrase like "the reference shape, distilled."

Respond with ONLY the JSON, no prose before or after.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 501 });
  }

  let topic: string;
  let context: string;
  try {
    const body: unknown = await request.json();
    const parsedBody = body as { topic?: unknown; context?: unknown } | null;
    topic = typeof parsedBody?.topic === "string" ? parsedBody.topic.trim() : "";
    context = typeof parsedBody?.context === "string" ? parsedBody.context.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: MAP_SCHEMA },
      },
      system: ARCHITECT_PERSONA_PROMPT,
      messages: [{ role: "user", content: USER_PROMPT_TEMPLATE(topic, context) }],
    });

    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    if (!textBlock) {
      return NextResponse.json({ error: "no text content in response" }, { status: 502 });
    }

    const parsed: unknown = JSON.parse(textBlock.text);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
