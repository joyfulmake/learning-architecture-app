"use client";

import { useState } from "react";
import type { ClarifyingQuestion } from "@/lib/types";

export function ClarifyingQuestions({
  questions,
  loading,
  onSubmit,
  onSkip,
}: {
  questions: ClarifyingQuestion[];
  loading: boolean;
  onSubmit: (answers: string[]) => void;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<(string | null)[]>(Array(questions.length).fill(null));

  const allAnswered = answers.every((a) => a !== null);

  return (
    <div className="rounded-2xl border-2 border-gray-200 p-6">
      <div className="text-sm font-bold text-gray-500">
        Before building this, one thing worth pinning down:
      </div>

      <div className="mt-4 flex flex-col gap-5">
        {questions.map((q, qi) => (
          <div key={q.question}>
            <p className="font-semibold text-sm">{q.question}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {q.options.map((option) => (
                <button
                  key={option}
                  onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? option : a)))}
                  className={`px-3 py-1.5 rounded-full border-2 text-sm font-semibold transition ${
                    answers[qi] === option
                      ? "border-green-500 bg-green-50 text-green-800"
                      : "border-gray-300 text-gray-600 hover:border-gray-500"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => onSubmit(answers as string[])}
          disabled={!allAnswered || loading}
          className="px-6 py-2.5 rounded-full bg-gray-900 text-white font-bold text-sm disabled:opacity-40 hover:bg-gray-700 transition"
        >
          {loading ? "Building the map…" : "Answer and build the map"}
        </button>
        <button
          onClick={onSkip}
          disabled={loading}
          className="px-5 py-2.5 rounded-full border-2 border-gray-300 font-bold text-sm text-gray-600 hover:border-gray-500 transition disabled:opacity-40"
        >
          Skip, just build it
        </button>
      </div>
    </div>
  );
}
