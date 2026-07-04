import { makeId, slugify } from "./id";
import { initialReinforcement } from "./spacedRepetition";
import type { ArchitectureMap, ClarifyingQuestion, ZenithReference } from "./types";

interface GeneratedNode {
  label: string;
  dependsOn: string[];
  what: string;
  why: string;
  how: string;
  equation: string;
  connection: string;
  structure: string;
  behavior: string;
  marketImplementation: string;
  insight: string;
}
interface GeneratedPhase {
  title: string;
  summary: string;
  nodes: GeneratedNode[];
}
interface GeneratedMapPayload {
  tagline: string;
  phases: GeneratedPhase[];
}

function isValidPayload(value: unknown): value is GeneratedMapPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as { tagline?: unknown; phases?: unknown };
  if (typeof v.tagline !== "string") return false;
  const phases = v.phases;
  if (!Array.isArray(phases) || phases.length === 0) return false;
  return phases.every((p) => {
    if (!p || typeof p !== "object") return false;
    const phase = p as { title?: unknown; summary?: unknown; nodes?: unknown };
    if (typeof phase.title !== "string" || typeof phase.summary !== "string") return false;
    if (!Array.isArray(phase.nodes) || phase.nodes.length === 0) return false;
    return phase.nodes.every((n) => {
      if (!n || typeof n !== "object") return false;
      const node = n as GeneratedNode;
      return (
        typeof node.label === "string" &&
        Array.isArray(node.dependsOn) &&
        node.dependsOn.every((d) => typeof d === "string") &&
        typeof node.what === "string" &&
        typeof node.why === "string" &&
        typeof node.how === "string" &&
        typeof node.equation === "string" &&
        typeof node.connection === "string" &&
        typeof node.structure === "string" &&
        typeof node.behavior === "string" &&
        typeof node.marketImplementation === "string" &&
        typeof node.insight === "string"
      );
    });
  });
}

// Attempts real, senior-architect-persona generation via /api/generate-map.
// Returns null on any failure (no key configured, network error, malformed
// response) so the caller falls back to the deterministic mock generator.
// `context` carries answers to clarifying questions (see tryGetClarifyingQuestions),
// serialized as plain text and threaded into the generation prompt.
export async function tryGenerateArchitectureViaApi(
  topic: string,
  context = "",
): Promise<GeneratedMapPayload | null> {
  try {
    const res = await fetch("/api/generate-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, context }),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isValidPayload(data) ? data : null;
  } catch {
    return null;
  }
}

interface ClarifyPayload {
  needsClarification: boolean;
  questions: ClarifyingQuestion[];
}

function isValidClarifyPayload(value: unknown): value is ClarifyPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as { needsClarification?: unknown; questions?: unknown };
  if (typeof v.needsClarification !== "boolean") return false;
  if (!Array.isArray(v.questions)) return false;
  return v.questions.every(
    (q) =>
      q &&
      typeof q === "object" &&
      typeof (q as ClarifyingQuestion).question === "string" &&
      Array.isArray((q as ClarifyingQuestion).options) &&
      (q as ClarifyingQuestion).options.every((o) => typeof o === "string"),
  );
}

// Asks whether the raw topic is genuinely ambiguous before committing to a
// full generation call. Returns null on any failure (no key, network error,
// malformed response) so the caller skips straight to generation, same
// fallback discipline as the main generation call.
export async function tryGetClarifyingQuestions(topic: string): Promise<ClarifyPayload | null> {
  try {
    const res = await fetch("/api/clarify-topic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isValidClarifyPayload(data) ? data : null;
  } catch {
    return null;
  }
}

export function buildArchitectureMapFromPayload(topic: string, payload: GeneratedMapPayload): ArchitectureMap {
  const now = new Date().toISOString();
  const phases = payload.phases.map((p, i) => ({
    id: makeId("phase"),
    title: `Phase ${i + 1}: ${p.title}`,
    summary: p.summary,
    notes: [],
  }));

  const nodes: ArchitectureMap["nodes"] = [];
  // Resolve each node's "dependsOn" (exact prior-phase labels, from the model's
  // own reasoning) against a label -> id map built strictly phase by phase, so
  // a node can only ever depend on something from an earlier phase, never its
  // own phase or a later one, matching the generation prompt's contract.
  const labelToId = new Map<string, string>();

  payload.phases.forEach((p, phaseIndex) => {
    const phase = phases[phaseIndex];
    const phaseNodes = p.nodes.map((n) => {
      const prereqIds = n.dependsOn
        .map((label) => labelToId.get(label.trim().toLowerCase()))
        .filter((id): id is string => Boolean(id));

      return {
        id: makeId("node"),
        phaseId: phase.id,
        label: n.label,
        what: n.what,
        why: n.why,
        how: n.how,
        equation: n.equation,
        connection: n.connection,
        prereqIds,
        completed: false,
        completedAt: null,
        notes: [],
      };
    });

    phaseNodes.forEach((node, i) => labelToId.set(p.nodes[i].label.trim().toLowerCase(), node.id));
    nodes.push(...phaseNodes);
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

export function buildZenithFromPayload(topic: string, payload: GeneratedMapPayload): ZenithReference {
  const nodes = payload.phases.flatMap((p) =>
    p.nodes.map((n) => ({
      id: makeId("zenith"),
      phaseTitle: p.title,
      label: n.label,
      structure: n.structure,
      behavior: n.behavior,
      connection: n.connection,
      equation: n.equation,
      marketImplementation: n.marketImplementation,
      insight: n.insight,
      notes: [],
      reinforcement: initialReinforcement(),
    })),
  );

  return {
    topicSlug: slugify(topic),
    topic,
    tagline: payload.tagline,
    nodes,
    generatedAt: new Date().toISOString(),
  };
}
