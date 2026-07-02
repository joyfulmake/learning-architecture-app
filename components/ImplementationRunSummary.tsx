"use client";

import type { ImplementationRun } from "@/lib/types";

export function ImplementationRunSummary({
  run,
  onPickAnother,
  onRunAgain,
}: {
  run: ImplementationRun;
  onPickAnother: () => void;
  onRunAgain: () => void;
}) {
  return (
    <div className="rounded-3xl border-2 border-green-300 bg-green-50/60 p-8 text-center shadow-[0_0_0_3px_rgba(22,163,74,0.1)]">
      <div className="text-sm font-extrabold uppercase tracking-wide text-green-700">
        ✓ {run.totalIterations} of {run.totalIterations} iterations practiced
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {run.iterations.map((it) => {
          const best = it.attempts.length ? Math.max(...it.attempts.map((a) => a.correctCount)) : 0;
          const passed = best / 5 >= 0.5;
          return (
            <span
              key={it.index}
              className={`h-3 w-3 rounded-full ${passed ? "bg-green-500" : "bg-amber-500"}`}
            />
          );
        })}
      </div>

      <p className="mt-5 text-lg font-bold text-gray-900">
        Nice work drilling &ldquo;{run.implementation.title}&rdquo;.
      </p>
      <p className="text-sm text-gray-500 mt-1">
        {run.totalIterations} reps, {run.totalIterations} different factors, one shape building into instinct.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={onPickAnother}
          className="px-5 py-2.5 rounded-full bg-gray-900 text-white font-bold text-sm hover:bg-gray-700 transition"
        >
          Practice another implementation
        </button>
        <button
          onClick={onRunAgain}
          className="px-5 py-2.5 rounded-full border-2 border-gray-300 font-bold text-sm hover:border-gray-500 transition"
        >
          Run this one again
        </button>
      </div>
    </div>
  );
}
