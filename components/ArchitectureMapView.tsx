"use client";

import { useRef } from "react";
import { downloadOfflineExport } from "@/lib/offlineExport";
import { getNodeStatus } from "@/lib/nodeStatus";
import type { ArchitectureMap } from "@/lib/types";
import { DependencyLines } from "./DependencyLines";
import { NodeCard } from "./NodeCard";

export function ArchitectureMapView({
  map,
  onToggleNode,
}: {
  map: ArchitectureMap;
  onToggleNode: (nodeId: string) => void;
}) {
  const totalNodes = map.nodes.length;
  const doneNodes = map.nodes.filter((n) => n.completed).length;
  const progressPct = totalNodes ? Math.round((doneNodes / totalNodes) * 100) : 0;
  const containerRef = useRef<HTMLDivElement>(null);

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
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
