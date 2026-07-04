"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { makeId, slugify } from "@/lib/id";
import { pickNodeToReinforce, reinforce } from "@/lib/spacedRepetition";
import {
  buildImplementationRun,
  generateArchitectureMap,
  generateImplementations,
  generateReferences,
  generateZenithReference,
} from "@/lib/mockGenerate";
import {
  buildArchitectureMapFromPayload,
  buildZenithFromPayload,
  tryGenerateArchitectureViaApi,
  tryGetClarifyingQuestions,
} from "@/lib/realGenerate";
import type {
  ArchitectureMap,
  ClarifyingQuestion,
  Implementation,
  ImplementationRun,
  QuizAttempt,
  ZenithReference,
} from "@/lib/types";

interface AppState {
  maps: ArchitectureMap[];
  activeMapId: string | null;
  setActiveMapId: (id: string) => void;
  zenithsBySlug: Record<string, ZenithReference>;
  implementationsBySlug: Record<string, Implementation[]>;
  implementationRuns: ImplementationRun[];
  getClarifyingQuestions: (topic: string) => Promise<ClarifyingQuestion[] | null>;
  createMap: (topic: string, context?: string) => Promise<ArchitectureMap>;
  toggleNode: (mapId: string, nodeId: string) => Promise<void>;
  addNodeNote: (mapId: string, nodeId: string, text: string) => void;
  addPhaseNote: (mapId: string, phaseId: string, text: string) => void;
  addZenithNodeNote: (topicSlug: string, zenithNodeId: string, text: string) => void;
  startImplementationRun: (implementation: Implementation, totalIterations: number) => Promise<ImplementationRun>;
  submitIterationPractice: (runId: string, iterationIndex: number, choiceLabel: string) => void;
  submitQuizAttempt: (runId: string, iterationIndex: number, answers: number[]) => void;
  advanceIteration: (runId: string) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [maps, setMaps] = useState<ArchitectureMap[]>([]);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [zenithsBySlug, setZenithsBySlug] = useState<Record<string, ZenithReference>>({});
  const [implementationsBySlug, setImplementationsBySlug] = useState<Record<string, Implementation[]>>({});
  const [implementationRuns, setImplementationRuns] = useState<ImplementationRun[]>([]);

  const ensureZenith = useCallback(async (topic: string) => {
    const slug = slugify(topic);
    const zenith = await generateZenithReference(topic);
    setZenithsBySlug((prev) => (prev[slug] ? prev : { ...prev, [slug]: zenith }));
  }, []);

  const ensureImplementations = useCallback(async (topic: string) => {
    const slug = slugify(topic);
    const implementations = await generateImplementations(topic);
    setImplementationsBySlug((prev) => (prev[slug] ? prev : { ...prev, [slug]: implementations }));
  }, []);

  const getClarifyingQuestions = useCallback(async (topic: string) => {
    const result = await tryGetClarifyingQuestions(topic);
    if (!result || !result.needsClarification || result.questions.length === 0) return null;
    return result.questions.slice(0, 3);
  }, []);

  const createMap = useCallback(
    async (topic: string, context = "") => {
      const realPayload = await tryGenerateArchitectureViaApi(topic, context);
      const map = realPayload
        ? buildArchitectureMapFromPayload(topic, realPayload)
        : await generateArchitectureMap(topic);

      setMaps((prev) => [...prev, map]);
      setActiveMapId(map.id);

      if (realPayload) {
        const zenith = buildZenithFromPayload(topic, realPayload);
        setZenithsBySlug((prev) => (prev[map.slug] ? prev : { ...prev, [map.slug]: zenith }));
      } else {
        void ensureZenith(topic);
      }
      void ensureImplementations(topic);
      return map;
    },
    [ensureZenith, ensureImplementations],
  );

  const toggleNode = useCallback(async (mapId: string, nodeId: string) => {
    const map = maps.find((m) => m.id === mapId);
    const node = map?.nodes.find((n) => n.id === nodeId);
    if (!map || !node) return;

    const willComplete = !node.completed;
    const shouldFetchRefs = willComplete && !map.references[nodeId];

    setMaps((prev) =>
      prev.map((m) =>
        m.id !== mapId
          ? m
          : {
              ...m,
              nodes: m.nodes.map((n) =>
                n.id !== nodeId
                  ? n
                  : { ...n, completed: willComplete, completedAt: willComplete ? new Date().toISOString() : null },
              ),
              updatedAt: new Date().toISOString(),
            },
      ),
    );

    if (shouldFetchRefs) {
      const refs = await generateReferences(node.label);
      setMaps((prev) =>
        prev.map((m) =>
          m.id === mapId ? { ...m, references: { ...m.references, [nodeId]: refs } } : m,
        ),
      );
    }
  }, [maps]);

  const addNodeNote = useCallback((mapId: string, nodeId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const note = { id: makeId("note"), text: trimmed, createdAt: new Date().toISOString() };
    setMaps((prev) =>
      prev.map((m) =>
        m.id !== mapId
          ? m
          : {
              ...m,
              nodes: m.nodes.map((n) => (n.id !== nodeId ? n : { ...n, notes: [...n.notes, note] })),
              updatedAt: new Date().toISOString(),
            },
      ),
    );
  }, []);

  const addPhaseNote = useCallback((mapId: string, phaseId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const note = { id: makeId("note"), text: trimmed, createdAt: new Date().toISOString() };
    setMaps((prev) =>
      prev.map((m) =>
        m.id !== mapId
          ? m
          : {
              ...m,
              phases: m.phases.map((p) => (p.id !== phaseId ? p : { ...p, notes: [...p.notes, note] })),
              updatedAt: new Date().toISOString(),
            },
      ),
    );
  }, []);

  const addZenithNodeNote = useCallback((topicSlug: string, zenithNodeId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const note = { id: makeId("note"), text: trimmed, createdAt: new Date().toISOString() };
    setZenithsBySlug((prev) => {
      const zenith = prev[topicSlug];
      if (!zenith) return prev;
      return {
        ...prev,
        [topicSlug]: {
          ...zenith,
          nodes: zenith.nodes.map((n) => (n.id !== zenithNodeId ? n : { ...n, notes: [...n.notes, note] })),
        },
      };
    });
  }, []);

  const startImplementationRun = useCallback(async (implementation: Implementation, totalIterations: number) => {
    const run = await buildImplementationRun(implementation, totalIterations);
    setImplementationRuns((prev) => [...prev, run]);
    return run;
  }, []);

  const submitIterationPractice = useCallback((runId: string, iterationIndex: number, choiceLabel: string) => {
    setImplementationRuns((prev) =>
      prev.map((run) => {
        if (run.id !== runId) return run;
        const iterations = run.iterations.map((it) => {
          if (it.index !== iterationIndex) return it;
          const choice = it.practice.choices.find((c) => c.label === choiceLabel);
          if (!choice) return it;
          return {
            ...it,
            pickedLabel: choice.label,
            practiceConsequence: choice.consequence,
            practiceWarning: choice.warning,
            practiceClean: choice.clean,
            status: "practiced" as const,
          };
        });
        return { ...run, iterations, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  // A completed quiz attempt is the "rep finished" event that drives the
  // zenith's spaced-repetition scheduling: it reinforces whichever zenith node
  // is currently the biggest gap (untouched, or most overdue for review), not
  // a specific node tied to this implementation, since implementations aren't
  // generated with an explicit link back to individual zenith nodes.
  const reinforceZenithGap = useCallback((topicSlug: string, passed: boolean) => {
    setZenithsBySlug((prev) => {
      const zenith = prev[topicSlug];
      if (!zenith || zenith.nodes.length === 0) return prev;
      const targetId = pickNodeToReinforce(zenith.nodes);
      if (!targetId) return prev;
      return {
        ...prev,
        [topicSlug]: {
          ...zenith,
          nodes: zenith.nodes.map((n) =>
            n.id !== targetId ? n : { ...n, reinforcement: reinforce(n.reinforcement, passed) },
          ),
        },
      };
    });
  }, []);

  const submitQuizAttempt = useCallback((runId: string, iterationIndex: number, answers: number[]) => {
    const run = implementationRuns.find((r) => r.id === runId);
    const iteration = run?.iterations.find((it) => it.index === iterationIndex);
    if (!run || !iteration) return;

    const correctCount = iteration.quiz.filter((q, i) => answers[i] === q.correctIndex).length;
    const attempt: QuizAttempt = { answers, correctCount, attemptedAt: new Date().toISOString() };

    setImplementationRuns((prev) =>
      prev.map((r) => {
        if (r.id !== runId) return r;
        const iterations = r.iterations.map((it) =>
          it.index !== iterationIndex ? it : { ...it, attempts: [...it.attempts, attempt], status: "quizzed" as const },
        );
        return { ...r, iterations, updatedAt: new Date().toISOString() };
      }),
    );

    reinforceZenithGap(run.implementation.topicSlug, correctCount / iteration.quiz.length >= 0.5);
  }, [implementationRuns, reinforceZenithGap]);

  const advanceIteration = useCallback((runId: string) => {
    setImplementationRuns((prev) =>
      prev.map((run) => {
        if (run.id !== runId) return run;
        const nextIndex = run.currentIterationIndex + 1;
        const finished = nextIndex >= run.totalIterations;
        return {
          ...run,
          currentIterationIndex: finished ? run.currentIterationIndex : nextIndex,
          finished,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const value = useMemo(
    () => ({
      maps,
      activeMapId,
      setActiveMapId,
      zenithsBySlug,
      implementationsBySlug,
      implementationRuns,
      getClarifyingQuestions,
      createMap,
      toggleNode,
      addNodeNote,
      addPhaseNote,
      addZenithNodeNote,
      startImplementationRun,
      submitIterationPractice,
      submitQuizAttempt,
      advanceIteration,
    }),
    [
      maps,
      activeMapId,
      zenithsBySlug,
      implementationsBySlug,
      implementationRuns,
      getClarifyingQuestions,
      createMap,
      toggleNode,
      addNodeNote,
      addPhaseNote,
      addZenithNodeNote,
      startImplementationRun,
      submitIterationPractice,
      submitQuizAttempt,
      advanceIteration,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
