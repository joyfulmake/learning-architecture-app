"use client";

import { useState } from "react";
import { useAppState } from "@/app/providers";
import { ArchitectureMapView } from "@/components/ArchitectureMapView";
import { ClarifyingQuestions } from "@/components/ClarifyingQuestions";
import type { ClarifyingQuestion } from "@/lib/types";

export default function ArchitecturePage() {
  const { maps, activeMapId, setActiveMapId, getClarifyingQuestions, createMap, toggleNode, addNodeNote, addPhaseNote } =
    useAppState();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);
  const [clarifyQuestions, setClarifyQuestions] = useState<ClarifyingQuestion[] | null>(null);

  const selectedMap = maps.find((m) => m.id === activeMapId) ?? maps[maps.length - 1];

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const questions = await getClarifyingQuestions(trimmed);
      if (questions) {
        setPendingTopic(trimmed);
        setClarifyQuestions(questions);
        setTopic("");
      } else {
        await createMap(trimmed);
        setTopic("");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswerSubmit(answers: string[]) {
    if (!pendingTopic || !clarifyQuestions) return;
    setLoading(true);
    try {
      const context = clarifyQuestions
        .map((q, i) => `Q: ${q.question}\nA: ${answers[i]}`)
        .join("\n\n");
      await createMap(pendingTopic, context);
      setPendingTopic(null);
      setClarifyQuestions(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipClarify() {
    if (!pendingTopic) return;
    setLoading(true);
    try {
      await createMap(pendingTopic);
      setPendingTopic(null);
      setClarifyQuestions(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Turn any topic into a climbable map.</h1>
      <p className="mt-1 text-sm text-gray-500">Type a topic, build it phase by phase, unlock the next step by finishing the last.</p>

      <form onSubmit={handleGenerate} className="flex gap-3 mt-6 mb-8">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Type a topic, e.g. Rust in the Linux kernel"
          disabled={Boolean(clarifyQuestions)}
          className="flex-1 rounded-full border-2 border-gray-300 px-5 py-3 text-base font-medium focus:outline-none focus:border-green-500 disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={loading || !topic.trim() || Boolean(clarifyQuestions)}
          className="px-6 py-3 rounded-full bg-gray-900 text-white font-bold text-base disabled:opacity-40 hover:bg-gray-700 transition"
        >
          {loading && !clarifyQuestions ? "Checking…" : "Generate map"}
        </button>
      </form>

      {clarifyQuestions && (
        <div className="mb-8">
          <ClarifyingQuestions
            questions={clarifyQuestions}
            loading={loading}
            onSubmit={handleAnswerSubmit}
            onSkip={handleSkipClarify}
          />
        </div>
      )}

      {maps.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {maps.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMapId(m.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 transition ${
                m.id === selectedMap?.id
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-600 hover:border-gray-500"
              }`}
            >
              {m.topic}
            </button>
          ))}
        </div>
      )}

      {selectedMap ? (
        <ArchitectureMapView
          map={selectedMap}
          onToggleNode={(nodeId) => toggleNode(selectedMap.id, nodeId)}
          onAddNodeNote={(nodeId, text) => addNodeNote(selectedMap.id, nodeId, text)}
          onAddPhaseNote={(phaseId, text) => addPhaseNote(selectedMap.id, phaseId, text)}
        />
      ) : !clarifyQuestions ? (
        <p className="text-gray-500 text-base">
          Type a topic above to generate a phased dependency map.
        </p>
      ) : null}
    </div>
  );
}
