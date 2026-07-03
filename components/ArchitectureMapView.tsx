"use client";

import { useRef } from "react";
import { downloadOfflineExport } from "@/lib/offlineExport";
import { getNodeStatus } from "@/lib/nodeStatus";
import type { ArchitectureMap } from "@/lib/types";
import { DependencyLines } from "./DependencyLines";
import { NodeCard } from "./NodeCard";
import { NoteCapture } from "./NoteCapture";

export function ArchitectureMapView({
  map,
  onToggleNode,
  onAddNodeNote,
  onAddPhaseNote,
}: {
  map: ArchitectureMap;
  onToggleNode: (nodeId: string) => void;
  onAddNodeNote: (nodeId: string, text: string) => void;
  onAddPhaseNote: (phaseId: string, text: string) => void;
}) {
  const totalNodes = map.nodes.length;
  const doneNodes = map.nodes.filter((n) => n.completed).length;
  const progressPct = totalNodes ? Math.round((doneNodes / totalNodes) * 100) : 0;
  const containerRef = useRef<HTMLDivElement>(null);

  const hasReferencesOrNotes =
    map.phases.some((p) => p.notes.length > 0) ||
    map.nodes.some((n) => n.notes.length > 0 || (map.references[n.id]?.length ?? 0) > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold truncate">{map.topic}</h2>
          <p className="text-sm text-gray-500">
            {doneNodes} of {totalNodes} subtopics completed
          </p>
        </div>
        <button
          onClick={() => downloadOfflineExport(map)}
          className="shrink-0 px-4 py-2 rounded-full border-2 border-gray-300 font-bold text-sm hover:border-gray-500 transition"
        >
          Export offline HTML
        </button>
      </div>

      <div className="h-1.5 w-full rounded-full bg-gray-100 mb-6 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="overflow-x-auto pb-4">
        <div ref={containerRef} className="relative flex gap-8">
          <DependencyLines nodes={map.nodes} containerRef={containerRef} />
          {map.phases.map((phase) => (
            <div key={phase.id} className="min-w-[280px] flex flex-col gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  {phase.title}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{phase.summary}</div>
                <NoteCapture notes={phase.notes} onAdd={(text) => onAddPhaseNote(phase.id, text)} compact />
              </div>
              {map.nodes
                .filter((n) => n.phaseId === phase.id)
                .map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    status={getNodeStatus(node, map.nodes)}
                    references={map.references[node.id]}
                    onToggle={() => onToggleNode(node.id)}
                    onAddNote={(text) => onAddNodeNote(node.id, text)}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>

      {hasReferencesOrNotes && (
        <div className="mt-10 pt-8 border-t-2 border-gray-100">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-gray-400 mb-4">
            References &amp; Notes
          </h3>
          <div className="flex flex-col gap-6">
            {map.phases.map((phase) => {
              const phaseNodes = map.nodes.filter((n) => n.phaseId === phase.id);
              const phaseHasContent =
                phase.notes.length > 0 ||
                phaseNodes.some((n) => n.notes.length > 0 || (map.references[n.id]?.length ?? 0) > 0);
              if (!phaseHasContent) return null;

              return (
                <div key={phase.id}>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">{phase.title}</div>

                  {phase.notes.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {phase.notes.map((note) => (
                        <li key={note.id} className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 inline-block mr-2">
                          {note.text}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-2 flex flex-col gap-3">
                    {phaseNodes.map((node) => {
                      const refs = map.references[node.id];
                      if (!refs?.length && node.notes.length === 0) return null;
                      return (
                        <div key={node.id} className="pl-3 border-l-2 border-gray-100">
                          <div className="text-sm font-semibold text-gray-800">{node.label}</div>
                          {refs && refs.length > 0 && (
                            <ul className="mt-1 space-y-1">
                              {refs.map((ref) => (
                                <li key={ref.url} className="text-xs">
                                  <a
                                    href={ref.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-green-700 underline decoration-green-300 hover:decoration-green-600"
                                  >
                                    {ref.title}
                                  </a>
                                  <span className="text-gray-500"> — {ref.why}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {node.notes.length > 0 && (
                            <ul className="mt-1 space-y-1">
                              {node.notes.map((note) => (
                                <li key={note.id} className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 inline-block mr-2">
                                  {note.text}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
