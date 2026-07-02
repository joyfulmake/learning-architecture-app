"use client";

import type { ImplementationRun, IterationState } from "@/lib/types";

function dotClass(iteration: IterationState, isCurrent: boolean): string {
  const base = "h-3 w-3 rounded-full transition";
  if (iteration.status !== "quizzed") {
    return `${base} ${isCurrent ? "bg-gray-400 ring-4 ring-gray-200" : "bg-gray-200"}`;
  }
  const best = Math.max(...iteration.attempts.map((a) => a.correctCount));
  const passed = best / 5 >= 0.5;
  const color = passed ? "bg-green-500" : "bg-amber-500";
  return `${base} ${color} ${isCurrent ? "ring-4 ring-gray-200" : ""}`;
}

export function IterationChecklist({ run }: { run: ImplementationRun }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-bold text-gray-700 mr-1">
        Iteration {Math.min(run.currentIterationIndex + 1, run.totalIterations)} of {run.totalIterations}
      </span>
      {run.iterations.map((it) => (
        <span key={it.index} className={dotClass(it, it.index === run.currentIterationIndex)} />
      ))}
    </div>
  );
}
