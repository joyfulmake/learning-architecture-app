"use client";

import { useState } from "react";
import { useAppState } from "@/app/providers";
import { ArchitectureMapView } from "@/components/ArchitectureMapView";

export default function ArchitecturePage() {
  const { maps, activeMapId, setActiveMapId, createMap, toggleNode } = useAppState();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedMap = maps.find((m) => m.id === activeMapId) ?? maps[maps.length - 1];

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await createMap(trimmed);
      setTopic("");
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
          className="flex-1 rounded-full border-2 border-gray-300 px-5 py-3 text-base font-medium focus:outline-none focus:border-green-500"
        />
        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className="px-6 py-3 rounded-full bg-gray-900 text-white font-bold text-base disabled:opacity-40 hover:bg-gray-700 transition"
        >
          {loading ? "Generating…" : "Generate map"}
        </button>
      </form>

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
        />
      ) : (
        <p className="text-gray-500 text-base">
          Type a topic above to generate a phased dependency map.
        </p>
      )}
    </div>
  );
}
