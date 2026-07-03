"use client";

import type { ArchitectureNode, NodeReference, NodeStatus } from "@/lib/types";
import { NoteCapture } from "./NoteCapture";

const STATUS_STYLES: Record<NodeStatus, string> = {
  locked: "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed",
  ready: "border-green-400 bg-gradient-to-br from-green-50 to-white shadow-[0_0_0_3px_rgba(22,163,74,0.12)] cursor-pointer",
  completed: "border-green-600 bg-gradient-to-br from-green-100 to-green-50 shadow-[0_0_0_3px_rgba(22,163,74,0.22)] cursor-pointer",
};

export function NodeCard({
  node,
  status,
  references,
  onToggle,
  onAddNote,
}: {
  node: ArchitectureNode;
  status: NodeStatus;
  references: NodeReference[] | undefined;
  onToggle: () => void;
  onAddNote: (text: string) => void;
}) {
  return (
    <div id={`node-${node.id}`} className={`rounded-2xl border-2 p-4 transition ${STATUS_STYLES[status]}`}>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={node.completed}
          disabled={status === "locked"}
          onChange={onToggle}
          className="mt-1 h-4 w-4 accent-green-600"
        />
        <div className="min-w-0">
          <div className="font-bold text-base leading-snug">{node.label}</div>
          {node.connection && (
            <p className="text-xs text-gray-500 italic mt-1">{node.connection}</p>
          )}
          <dl className="mt-2 space-y-1.5 text-sm">
            <div>
              <dt className="inline text-[11px] font-bold uppercase tracking-wide text-gray-400">What </dt>
              <dd className="inline text-gray-700">{node.what}</dd>
            </div>
            <div>
              <dt className="inline text-[11px] font-bold uppercase tracking-wide text-gray-400">Why </dt>
              <dd className="inline text-gray-700">{node.why}</dd>
            </div>
            <div>
              <dt className="inline text-[11px] font-bold uppercase tracking-wide text-gray-400">How </dt>
              <dd className="inline text-gray-700">{node.how}</dd>
            </div>
          </dl>

          {node.equation && (
            <div className="mt-2 rounded-lg bg-gray-900 px-3 py-2 font-mono text-xs text-green-300 overflow-x-auto">
              {node.equation}
            </div>
          )}
        </div>
      </label>

      {status === "completed" && (
        <div className="mt-3 pl-7">
          {!references ? (
            <div className="text-xs text-gray-500">Loading references…</div>
          ) : (
            <ul className="space-y-1.5">
              {references.map((ref) => (
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
        </div>
      )}

      <div className="pl-7">
        <NoteCapture notes={node.notes} onAdd={onAddNote} compact />
      </div>
    </div>
  );
}
