import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ARCHITECT_PERSONA_PROMPT } from "@/lib/prompts";

// Server only, same key/fallback discipline as generate-map. A lightweight
// judgment call, not a full generation: is this raw topic genuinely ambiguous
// in a way that would change what the map should look like? If so, ask up to
// 3 short questions before committing to a full generation call, instead of
// silently guessing at one interpretation.
export const runtime = "nodejs";

const CLARIFY_SCHEMA = {
  type: "object",
  properties: {
    needsClarification: { type: "boolean" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["question", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["needsClarification", "questions"],
  additionalProperties: false,
} as const;

const USER_PROMPT = (topic: string) => `Raw topic input from a learner: "${topic}"

You are about to build a full learning architecture map for this. Before doing that, decide: is there genuine ambiguity or missing context here that would meaningfully change what the ideal map looks like? For example, the phrase could plausibly refer to more than one distinct field or practice, or the right depth, scope, or angle genuinely depends on something not stated that a real mentor would ask before starting to teach this.

If the topic is already clear and well scoped as stated, set "needsClarification" to false and return an empty "questions" array. Do not invent doubt that isn't real just to ask something.

If there is genuine ambiguity, set "needsClarification" to true and write at most 3 short, concrete questions, each with 2 to 4 short concrete answer options. Ask only what actually changes the map for this specific topic. Do not ask generic filler like "what is your skill level" unless the answer would genuinely restructure the map, most of the time it will not. A sharp senior mentor asks one pointed question, not a form.

Respond with ONLY the JSON, no prose before or after.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 501 });
  }

  let topic: string;
  try {
    const body: unknown = await request.json();
    const rawTopic = (body as { topic?: unknown } | null)?.topic;
    topic = typeof rawTopic === "string" ? rawTopic.trim() : "";
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
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: CLARIFY_SCHEMA },
      },
      system: ARCHITECT_PERSONA_PROMPT,
      messages: [{ role: "user", content: USER_PROMPT(topic) }],
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
    const message = err instanceof Error ? err.message : "clarification check failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
