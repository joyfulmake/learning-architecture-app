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
                description: { type: "string" },
                insight: { type: "string" },
              },
              required: ["label", "description", "insight"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "summary", "nodes"],
        additionalProperties: false,
      },
    },
  },
  required: ["phases"],
  additionalProperties: false,
} as const;

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
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: MAP_SCHEMA },
      },
      system: ARCHITECT_PERSONA_PROMPT,
      messages: [
        {
          role: "user",
          content: `Topic: "${topic}"\n\nProduce exactly 3 phases, each with exactly 3 subtopics ("nodes"), building from foundational to advanced. Each phase's "title" must be a short, specific name for that stage (never literally "Foundations", "Core Mechanics", or "Edge Cases"). Each node's "label" is a 3 to 6 word subtopic name. "description" is one sentence, specific to this exact topic, explaining what a learner needs to understand there. "insight" is one sharp, senior practitioner level sentence: the kind of thing that separates someone who's actually shipped this from someone who's only read about it.`,
        },
      ],
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
