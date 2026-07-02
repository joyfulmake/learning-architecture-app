"use client";

import type { ChallengeRun } from "@/lib/types";

export function ChallengeView({
  run,
  onAnswer,
}: {
  run: ChallengeRun;
  onAnswer: (stageId: string, choiceLabel: string) => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 p-6">
      <h2 className="text-xl font-extrabold">{run.challenge.title}</h2>
      <p className="text-sm text-gray-600 mt-1">{run.challenge.setup}</p>

      <div className="mt-6 flex flex-col gap-6">
        {run.challenge.stages.map((stage, i) => {
          const state = run.stageStates.find((s) => s.stageId === stage.id);
          const prevAnswered = i === 0 || run.stageStates[i - 1].status === "answered";
          if (!prevAnswered) return null;

          return (
            <div key={stage.id} className="border-t border-gray-100 pt-5 first:border-0 first:pt-0">
              <p className="font-bold text-base">{stage.prompt}</p>

              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                <span>
                  <strong className="text-gray-700">Controlled:</strong>{" "}
                  {stage.controlledFactors.join(", ")}
                </span>
                <span>
                  <strong className="text-gray-700">Uncontrolled:</strong>{" "}
                  {stage.uncontrolledFactors.join(", ")}
                </span>
              </div>

              {state?.status === "pending" ? (
                <div className="mt-3 flex flex-col gap-2">
                  {stage.choices.map((choice) => (
                    <button
                      key={choice.label}
                      onClick={() => onAnswer(stage.id, choice.label)}
                      className="text-left px-4 py-2.5 rounded-lg border-2 border-gray-300 font-semibold text-sm hover:border-gray-900 transition"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className={`mt-3 rounded-lg border-2 p-3 text-sm ${
                    state?.clean
                      ? "border-green-400 bg-green-50"
                      : "border-amber-400 bg-amber-50"
                  }`}
                >
                  <div className="font-bold">You picked: {state?.pickedLabel}</div>
                  <div className="text-gray-700 mt-1">{state?.consequence}</div>
                  {state?.warning && (
                    <div className="text-amber-800 font-semibold mt-1">⚠ {state.warning}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {run.finished && (
        <div
          className={`mt-6 rounded-xl p-4 text-center font-extrabold text-lg ${
            run.clean
              ? "bg-green-100 text-green-800 shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
              : "bg-amber-100 text-amber-800 shadow-[0_0_0_3px_rgba(217,119,6,0.15)]"
          }`}
        >
          {run.clean ? "Clean pass" : "Scar recorded"}
        </div>
      )}
    </div>
  );
}
