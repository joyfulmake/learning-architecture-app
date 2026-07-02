"use client";

import { useState } from "react";
import type { IterationState } from "@/lib/types";

const MAX_ATTEMPTS = 3;

function supportiveCopy(correctCount: number): string {
  const pct = correctCount / 5;
  if (pct >= 0.8) return "Sharp — that's locked in.";
  if (pct >= 0.5) return "Solid. The pattern is forming.";
  return "That's below halfway — worth one more pass while it's fresh.";
}

export function IterationQuizCard({
  iteration,
  onSubmit,
  onContinue,
}: {
  iteration: IterationState;
  onSubmit: (answers: number[]) => void;
  onContinue: () => void;
}) {
  const [draft, setDraft] = useState<(number | null)[]>(Array(iteration.quiz.length).fill(null));
  const [revealed, setRevealed] = useState(iteration.attempts.length > 0);

  const latestAttempt = iteration.attempts[iteration.attempts.length - 1] ?? null;
  const allAnswered = draft.every((a) => a !== null);
  const canRetry = latestAttempt !== null && latestAttempt.correctCount / 5 < 0.5 && iteration.attempts.length < MAX_ATTEMPTS;
  const retriesLeft = MAX_ATTEMPTS - iteration.attempts.length;

  function handleSubmit() {
    onSubmit(draft as number[]);
    setRevealed(true);
  }

  function handleRetry() {
    setDraft(Array(iteration.quiz.length).fill(null));
    setRevealed(false);
  }

  if (revealed && latestAttempt) {
    return (
      <div className="rounded-2xl border-2 border-gray-200 p-6">
        <div className="text-sm font-bold text-gray-500">Quick check — how it landed</div>
        <div
          className={`mt-3 rounded-xl p-4 text-center ${
            latestAttempt.correctCount / 5 >= 0.5
              ? "bg-green-100 text-green-800 shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
              : "bg-amber-100 text-amber-800 shadow-[0_0_0_3px_rgba(217,119,6,0.15)]"
          }`}
        >
          <div className="text-2xl font-extrabold">{latestAttempt.correctCount} / 5</div>
          <div className="text-sm font-semibold mt-1">{supportiveCopy(latestAttempt.correctCount)}</div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {canRetry && (
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 rounded-full border-2 border-amber-400 text-amber-800 font-bold text-sm hover:border-amber-600 transition"
            >
              Try again ({retriesLeft} left)
            </button>
          )}
          <button
            onClick={onContinue}
            className="px-5 py-2.5 rounded-full bg-gray-900 text-white font-bold text-sm hover:bg-gray-700 transition"
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-gray-200 p-6">
      <div className="text-sm font-bold text-gray-500">Quick check — 5 questions, no pressure</div>

      <div className="mt-4 flex flex-col gap-5">
        {iteration.quiz.map((q, qi) => (
          <div key={q.id}>
            <p className="font-semibold text-sm">
              {qi + 1}. {q.prompt}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {q.options.map((option, oi) => (
                <button
                  key={option}
                  onClick={() =>
                    setDraft((prev) => prev.map((v, i) => (i === qi ? oi : v)))
                  }
                  className={`text-left px-3 py-2 rounded-lg border-2 text-sm transition ${
                    draft[qi] === oi
                      ? "border-green-500 bg-green-50 font-semibold"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allAnswered}
        className="mt-5 px-6 py-2.5 rounded-full bg-gray-900 text-white font-bold text-sm disabled:opacity-40 hover:bg-gray-700 transition"
      >
        Submit
      </button>
    </div>
  );
}
