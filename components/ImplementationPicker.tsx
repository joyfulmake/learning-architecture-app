"use client";

import { useState } from "react";
import type { Implementation } from "@/lib/types";

const MIN_ITERATIONS = 1;
const MAX_ITERATIONS = 12;
const DEFAULT_ITERATIONS = 5;

export function ImplementationPicker({
  implementations,
  loading,
  onStart,
}: {
  implementations: Implementation[];
  loading: boolean;
  onStart: (implementation: Implementation, totalIterations: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iterations, setIterations] = useState(DEFAULT_ITERATIONS);

  const selected = implementations.find((i) => i.id === selectedId) ?? null;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {implementations.map((impl) => {
          const active = impl.id === selectedId;
          return (
            <button
              key={impl.id}
              onClick={() => setSelectedId(impl.id)}
              className={`text-left rounded-2xl border-2 p-4 transition ${
                active
                  ? "border-green-500 bg-green-50 shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <div className="font-bold text-sm">{impl.title}</div>
              <div className="text-xs text-gray-500 mt-1">{impl.blurb}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-3 text-sm font-bold text-gray-700">
          Reps to drill
          <input
            type="number"
            min={MIN_ITERATIONS}
            max={MAX_ITERATIONS}
            value={iterations}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isNaN(next)) return;
              setIterations(Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, next)));
            }}
            className="w-20 rounded-full border-2 border-gray-300 px-3 py-1.5 text-center font-bold focus:outline-none focus:border-green-500"
          />
        </label>
        <button
          onClick={() => selected && onStart(selected, iterations)}
          disabled={!selected || loading}
          className="px-6 py-3 rounded-full bg-gray-900 text-white font-bold text-base disabled:opacity-40 hover:bg-gray-700 transition"
        >
          {loading ? "Building practice…" : "Begin practice"}
        </button>
      </div>
    </div>
  );
}
