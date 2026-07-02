import { makeId, slugify } from "./id";
import type { ArchitectureMap, ZenithReference } from "./types";

interface GeneratedNode {
  label: string;
  description: string;
  insight: string;
}
interface GeneratedPhase {
  title: string;
  summary: string;
  nodes: GeneratedNode[];
}
interface GeneratedMapPayload {
  phases: GeneratedPhase[];
}

function isValidPayload(value: unknown): value is GeneratedMapPayload {
  if (!value || typeof value !== "object") return false;
  const phases = (value as { phases?: unknown }).phases;
  if (!Array.isArray(phases) || phases.length === 0) return false;
  return phases.every((p) => {
    if (!p || typeof p !== "object") return false;
    const phase = p as { title?: unknown; summary?: unknown; nodes?: unknown };
    if (typeof phase.title !== "string" || typeof phase.summary !== "string") return false;
    if (!Array.isArray(phase.nodes) || phase.nodes.length === 0) return false;
    return phase.nodes.every(
      (n) =>
        n &&
        typeof n === "object" &&
        typeof (n as GeneratedNode).label === "string" &&
        typeof (n as GeneratedNode).description === "string" &&
        typeof (n as GeneratedNode).insight === "string",
    );
  });
}

// Attempts real, senior-architect-persona generation via /api/generate-map.
// Returns null on any failure (no key configured, network error, malformed
// response) so the caller falls back to the deterministic mock generator.
export async function tryGenerateArchitectureViaApi(topic: string): Promise<GeneratedMapPayload | null> {
  try {
    const res = await fetch("/api/generate-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isValidPayload(data) ? data : null;
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
  }));

  const nodes: ArchitectureMap["nodes"] = [];
  payload.phases.forEach((p, phaseIndex) => {
    const phase = phases[phaseIndex];
    const prevPhaseNodes = nodes.filter((n) => n.phaseId === phases[phaseIndex - 1]?.id);
    p.nodes.forEach((n, nodeIndex) => {
      const prereqIds =
        phaseIndex === 0
          ? []
          : [prevPhaseNodes[nodeIndex % prevPhaseNodes.length]?.id].filter(
              (id): id is string => Boolean(id),
            );

      nodes.push({
        id: makeId("node"),
        phaseId: phase.id,
        label: `${topic}: ${n.label}`,
        description: n.description,
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

export function buildZenithFromPayload(topic: string, payload: GeneratedMapPayload): ZenithReference {
  const nodes = payload.phases.flatMap((p) =>
    p.nodes.map((n) => ({
      id: makeId("zenith"),
      phaseTitle: p.title,
      label: `${topic}: ${n.label}`,
      insight: n.insight,
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
