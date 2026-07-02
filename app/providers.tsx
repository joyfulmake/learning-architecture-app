"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { slugify } from "@/lib/id";
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
} from "@/lib/realGenerate";
import type {
  ArchitectureMap,
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
  createMap: (topic: string) => Promise<ArchitectureMap>;
  toggleNode: (mapId: string, nodeId: string) => Promise<void>;
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

  const createMap = useCallback(
    async (topic: string) => {
      const realPayload = await tryGenerateArchitectureViaApi(topic);
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

  const submitQuizAttempt = useCallback((runId: string, iterationIndex: number, answers: number[]) => {
    setImplementationRuns((prev) =>
      prev.map((run) => {
        if (run.id !== runId) return run;
        const iterations = run.iterations.map((it) => {
          if (it.index !== iterationIndex) return it;
          const correctCount = it.quiz.filter((q, i) => answers[i] === q.correctIndex).length;
          const attempt: QuizAttempt = { answers, correctCount, attemptedAt: new Date().toISOString() };
          return { ...it, attempts: [...it.attempts, attempt], status: "quizzed" as const };
        });
        return { ...run, iterations, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

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
      createMap,
      toggleNode,
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
      createMap,
      toggleNode,
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
