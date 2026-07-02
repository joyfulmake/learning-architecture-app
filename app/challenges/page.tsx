"use client";

import { useState } from "react";
import { useAppState } from "@/app/providers";
import { ImplementationPicker } from "@/components/ImplementationPicker";
import { IterationChecklist } from "@/components/IterationChecklist";
import { IterationPracticeCard } from "@/components/IterationPracticeCard";
import { IterationQuizCard } from "@/components/IterationQuizCard";
import { ImplementationRunSummary } from "@/components/ImplementationRunSummary";
import type { ImplementationRun, Implementation } from "@/lib/types";

function IterationFlow({ run }: { run: ImplementationRun }) {
  const { submitIterationPractice, submitQuizAttempt, advanceIteration } = useAppState();
  const [showQuiz, setShowQuiz] = useState(false);
  const iteration = run.iterations[run.currentIterationIndex];

  return (
    <div className="flex flex-col gap-5">
      <IterationChecklist run={run} />

      <IterationPracticeCard
        iteration={iteration}
        onPick={(label) => submitIterationPractice(run.id, iteration.index, label)}
      />

      {iteration.status === "practiced" && !showQuiz && (
        <button
          onClick={() => setShowQuiz(true)}
          className="self-start px-5 py-2.5 rounded-full bg-gray-900 text-white font-bold text-sm hover:bg-gray-700 transition"
        >
          Take the 5-question check →
        </button>
      )}

      {(showQuiz || iteration.status === "quizzed") && (
        <IterationQuizCard
          iteration={iteration}
          onSubmit={(answers) => submitQuizAttempt(run.id, iteration.index, answers)}
          onContinue={() => advanceIteration(run.id)}
        />
      )}
    </div>
  );
}

export default function ChallengesPage() {
  const { maps, activeMapId, implementationsBySlug, implementationRuns, startImplementationRun } = useAppState();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [pickingNew, setPickingNew] = useState(true);
  const [loading, setLoading] = useState(false);

  const activeMap = maps.find((m) => m.id === activeMapId) ?? maps[maps.length - 1];
  const implementations = activeMap ? implementationsBySlug[activeMap.slug] : undefined;
  const runsForTopic = activeMap
    ? implementationRuns.filter((r) => r.implementation.topicSlug === activeMap.slug)
    : [];
  const activeRun = runsForTopic.find((r) => r.id === activeRunId) ?? runsForTopic[runsForTopic.length - 1];

  async function handleStart(implementation: Implementation, totalIterations: number) {
    setLoading(true);
    try {
      const run = await startImplementationRun(implementation, totalIterations);
      setActiveRunId(run.id);
      setPickingNew(false);
    } finally {
      setLoading(false);
    }
  }

  if (!activeMap) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">Design it once. Make it instinct.</h1>
        <p className="mt-3 text-gray-500 text-base">
          Generate an architecture map on the Architecture tab first — the practice reps below are built
          around that topic.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Design it once. Make it instinct.</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pick a real-world angle on {activeMap.topic}, drill it in reps, one new factor each time.
      </p>

      {!pickingNew && runsForTopic.length > 1 && (
        <div className="flex gap-2 mt-5 mb-2 flex-wrap">
          {runsForTopic.map((run) => (
            <button
              key={run.id}
              onClick={() => setActiveRunId(run.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 transition ${
                run.id === activeRun?.id
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-600 hover:border-gray-500"
              }`}
            >
              {run.implementation.angle}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        {pickingNew || !activeRun ? (
          !implementations ? (
            <p className="text-gray-500 text-base">Generating implementations for this topic…</p>
          ) : (
            <ImplementationPicker implementations={implementations} loading={loading} onStart={handleStart} />
          )
        ) : activeRun.finished ? (
          <ImplementationRunSummary
            run={activeRun}
            onPickAnother={() => setPickingNew(true)}
            onRunAgain={() => handleStart(activeRun.implementation, activeRun.totalIterations)}
          />
        ) : (
          <IterationFlow key={`${activeRun.id}-${activeRun.currentIterationIndex}`} run={activeRun} />
        )}
      </div>
    </div>
  );
}
