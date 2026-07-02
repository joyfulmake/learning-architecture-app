"use client";

import type { IterationState } from "@/lib/types";

export function IterationPracticeCard({
  iteration,
  onPick,
}: {
  iteration: IterationState;
  onPick: (choiceLabel: string) => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 p-6">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-gray-600">
        Factor for this rep
      </div>
      <p className="mt-2 text-base font-bold text-gray-900">⚡ {iteration.factor}</p>

      <p className="mt-4 text-base">{iteration.practice.prompt}</p>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        <span>
          <strong className="text-gray-700">Controlled:</strong>{" "}
          {iteration.practice.controlledFactors.join(", ")}
        </span>
        <span>
          <strong className="text-gray-700">Uncontrolled:</strong>{" "}
          {iteration.practice.uncontrolledFactors.join(", ")}
        </span>
      </div>

      {iteration.pickedLabel === null ? (
        <div className="mt-4 flex flex-col gap-2">
          {iteration.practice.choices.map((choice) => (
            <button
              key={choice.label}
              onClick={() => onPick(choice.label)}
              className="text-left px-4 py-2.5 rounded-lg border-2 border-gray-300 font-semibold text-sm hover:border-gray-900 transition"
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : (
        <div
          className={`mt-4 rounded-lg border-2 p-3 text-sm ${
            iteration.practiceClean ? "border-green-400 bg-green-50" : "border-amber-400 bg-amber-50"
          }`}
        >
          <div className="font-bold">You picked: {iteration.pickedLabel}</div>
          <div className="text-gray-700 mt-1">{iteration.practiceConsequence}</div>
          {iteration.practiceWarning && (
            <div className="text-amber-800 font-semibold mt-1">⚠ {iteration.practiceWarning}</div>
          )}
        </div>
      )}
    </div>
  );
}
