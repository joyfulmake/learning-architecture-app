"use client";

import { useState } from "react";
import { useAppState } from "@/app/providers";
import { ChallengeView } from "@/components/ChallengeView";

export default function ChallengesPage() {
  const { maps, challenges, startChallenge, answerStage } = useAppState();
  const [selectedLabel, setSelectedLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const subtopics = maps.flatMap((m) => m.nodes.map((n) => n.label));
  const activeRun = challenges.find((r) => r.id === activeRunId) ?? challenges[challenges.length - 1];

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLabel) return;
    setLoading(true);
    try {
      const run = await startChallenge(selectedLabel);
      setActiveRunId(run.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleStart} className="flex gap-3 mb-8">
        <select
          value={selectedLabel}
          onChange={(e) => setSelectedLabel(e.target.value)}
          className="flex-1 rounded-full border-2 border-gray-300 px-5 py-3 text-base font-medium focus:outline-none focus:border-green-500 disabled:opacity-40"
          disabled={subtopics.length === 0}
        >
          <option value="">
            {subtopics.length === 0 ? "Generate an architecture map first" : "Pick a subtopic…"}
          </option>
          {subtopics.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading || !selectedLabel}
          className="px-6 py-3 rounded-full bg-gray-900 text-white font-bold text-base disabled:opacity-40 hover:bg-gray-700 transition"
        >
          {loading ? "Building scenario…" : "Start challenge"}
        </button>
      </form>

      {challenges.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {challenges.map((run) => (
            <button
              key={run.id}
              onClick={() => setActiveRunId(run.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 transition ${
                run.id === activeRun?.id
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-600 hover:border-gray-500"
              }`}
            >
              {run.challenge.subtopicLabel}
            </button>
          ))}
        </div>
      )}

      {activeRun ? (
        <ChallengeView
          run={activeRun}
          onAnswer={(stageId, choiceLabel) => answerStage(activeRun.id, stageId, choiceLabel)}
        />
      ) : (
        <p className="text-gray-500 text-base">
          Pick a subtopic from an architecture map to get a branching judgment scenario.
        </p>
      )}
    </div>
  );
}
