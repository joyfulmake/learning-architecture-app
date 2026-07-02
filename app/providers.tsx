"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { makeId } from "@/lib/id";
import {
  generateArchitectureMap,
  generateChallenge,
  generateReferences,
} from "@/lib/mockGenerate";
import type { ArchitectureMap, ChallengeRun, StageState } from "@/lib/types";

interface AppState {
  maps: ArchitectureMap[];
  challenges: ChallengeRun[];
  createMap: (topic: string) => Promise<ArchitectureMap>;
  toggleNode: (mapId: string, nodeId: string) => Promise<void>;
  startChallenge: (subtopicLabel: string) => Promise<ChallengeRun>;
  answerStage: (runId: string, stageId: string, choiceLabel: string) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [maps, setMaps] = useState<ArchitectureMap[]>([]);
  const [challenges, setChallenges] = useState<ChallengeRun[]>([]);

  const createMap = useCallback(async (topic: string) => {
    const map = await generateArchitectureMap(topic);
    setMaps((prev) => [...prev, map]);
    return map;
  }, []);

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

  const startChallenge = useCallback(async (subtopicLabel: string) => {
    const challenge = await generateChallenge(subtopicLabel);
    const run: ChallengeRun = {
      id: makeId("run"),
      challenge,
      stageStates: challenge.stages.map((s) => ({
        stageId: s.id,
        status: "pending",
        pickedLabel: null,
        consequence: null,
        warning: null,
        clean: null,
      })),
      finished: false,
      clean: true,
      updatedAt: new Date().toISOString(),
    };
    setChallenges((prev) => [...prev, run]);
    return run;
  }, []);

  const answerStage = useCallback((runId: string, stageId: string, choiceLabel: string) => {
    setChallenges((prev) =>
      prev.map((run) => {
        if (run.id !== runId) return run;
        const stage = run.challenge.stages.find((s) => s.id === stageId);
        const choice = stage?.choices.find((c) => c.label === choiceLabel);
        if (!stage || !choice) return run;

        const stageStates: StageState[] = run.stageStates.map((ss) =>
          ss.stageId === stageId
            ? {
                stageId,
                status: "answered",
                pickedLabel: choice.label,
                consequence: choice.consequence,
                warning: choice.warning,
                clean: choice.clean,
              }
            : ss,
        );

        const finished = stageStates.every((ss) => ss.status === "answered");
        const clean = stageStates.every((ss) => ss.clean !== false);

        return { ...run, stageStates, finished, clean, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const value = useMemo(
    () => ({ maps, challenges, createMap, toggleNode, startChallenge, answerStage }),
    [maps, challenges, createMap, toggleNode, startChallenge, answerStage],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
