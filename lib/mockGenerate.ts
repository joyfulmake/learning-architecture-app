import { makeId, slugify } from "./id";
import type {
  ArchitectureMap,
  Challenge,
  ChallengeStage,
  NodeReference,
} from "./types";

// Phase 1 stand-in for the real Convex action + Anthropic call (see spec section 3).
// Deterministic and local so the UI and interaction logic can be built and tested
// end to end before any server, auth, or billing exists.

const NETWORK_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PHASE_TEMPLATES = [
  { title: "Foundations", summary: "The load-bearing concepts everything else in this topic assumes you already have." },
  { title: "Core Mechanics", summary: "How the pieces actually fit together and interact under normal conditions." },
  { title: "Edge Cases and Tradeoffs", summary: "Where the simple model breaks and what decisions real practitioners have to make." },
];

const NODE_SUFFIXES = [
  ["the core vocabulary", "how it's structured", "why it exists"],
  ["the primary workflow", "common failure modes", "how to verify correctness"],
  ["performance tradeoffs", "when to reach for it", "what experts get wrong first"],
];

export async function generateArchitectureMap(topic: string): Promise<ArchitectureMap> {
  await delay(NETWORK_DELAY_MS);

  const now = new Date().toISOString();
  const phases = PHASE_TEMPLATES.map((template, i) => ({
    id: makeId("phase"),
    title: `Phase ${i + 1}: ${template.title}`,
    summary: template.summary,
  }));

  const nodes: ArchitectureMap["nodes"] = [];
  phases.forEach((phase, phaseIndex) => {
    NODE_SUFFIXES[phaseIndex].forEach((suffix, nodeIndex) => {
      const prevPhase = phases[phaseIndex - 1];
      const prereqIds =
        phaseIndex === 0
          ? []
          : [nodes.find((n) => n.phaseId === prevPhase.id && n.label.endsWith(NODE_SUFFIXES[phaseIndex - 1][nodeIndex]))?.id].filter(
              (id): id is string => Boolean(id),
            );

      nodes.push({
        id: makeId("node"),
        phaseId: phase.id,
        label: `${topic}: ${suffix}`,
        description: `What you need to understand about ${suffix} in the context of ${topic}.`,
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

export async function generateChallenge(subtopicLabel: string): Promise<Challenge> {
  await delay(NETWORK_DELAY_MS);

  const stages: ChallengeStage[] = [
    {
      id: makeId("stage"),
      prompt: `You're applying ${subtopicLabel} under time pressure. A teammate suggests skipping verification to ship faster.`,
      controlledFactors: ["You know the expected output shape", "Rollback is available"],
      uncontrolledFactors: ["Teammate's estimate of time saved may be wrong", "Downstream consumers are unknown"],
      choices: [
        {
          label: "Skip verification, ship now",
          consequence: "It breaks a downstream consumer within the hour.",
          warning: "Speed without verification just moves the cost to whoever hits the bug first.",
          clean: false,
        },
        {
          label: "Add a minimal check, then ship",
          consequence: "Ships slightly later, catches the one case that would have broken.",
          warning: null,
          clean: true,
        },
      ],
    },
    {
      id: makeId("stage"),
      prompt: `Later, you find a second, unrelated issue in the same area of ${subtopicLabel}. Do you fix it now or file it?`,
      controlledFactors: ["You already have context loaded"],
      uncontrolledFactors: ["Unclear how urgent it actually is to others"],
      choices: [
        {
          label: "Fix it now while context is fresh",
          consequence: "Small scope creep, but the fix is clean and fast.",
          warning: null,
          clean: true,
        },
        {
          label: "File it and move on",
          consequence: "Context is lost by the time anyone picks it up, costs more later.",
          warning: "Deferring is not free, it just moves the cost and adds a re-discovery tax.",
          clean: false,
        },
      ],
    },
  ];

  return {
    id: makeId("challenge"),
    subtopicLabel,
    title: `Judgment check: ${subtopicLabel}`,
    setup: `A scenario built to test how you apply ${subtopicLabel} when the factors aren't all under your control.`,
    stages,
  };
}
