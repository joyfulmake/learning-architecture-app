"use client";

import { useAppState } from "@/app/providers";
import { slugify } from "@/lib/id";
import { gapState } from "@/lib/spacedRepetition";
import type { ZenithNode } from "@/lib/types";
import { NoteCapture } from "./NoteCapture";

const GAP_DOT_CLASS: Record<ReturnType<typeof gapState>, string> = {
  gap: "bg-gray-300",
  due: "bg-amber-500",
  fresh: "bg-green-500",
};

const GAP_LABEL: Record<ReturnType<typeof gapState>, string> = {
  gap: "Not yet practiced",
  due: "Due for review",
  fresh: "Recently reinforced",
};

function GapDot({ node }: { node: ZenithNode }) {
  const state = gapState(node.reinforcement);
  return <span className={`inline-block h-2 w-2 rounded-full ${GAP_DOT_CLASS[state]}`} title={GAP_LABEL[state]} />;
}

export function ZenithSidebar() {
  const { maps, activeMapId, zenithsBySlug, addZenithNodeNote } = useAppState();
  const activeMap = maps.find((m) => m.id === activeMapId) ?? maps[maps.length - 1];

  if (!activeMap) {
    return (
      <aside className="lg:w-80 shrink-0">
        <div className="lg:sticky lg:top-8 rounded-3xl border-2 border-dashed border-gray-200 p-6 text-center">
          <div className="text-sm font-bold text-gray-400">✦ ZENITH REFERENCE</div>
          <p className="mt-2 text-sm text-gray-400">
            Generate your first map to unlock the zenith reference.
          </p>
        </div>
      </aside>
    );
  }

  const zenith = zenithsBySlug[slugify(activeMap.topic)];

  return (
    <aside className="lg:w-80 shrink-0">
      <div className="lg:sticky lg:top-8 rounded-3xl border-2 border-amber-200/70 bg-gradient-to-b from-amber-50/60 to-white p-6 shadow-[0_0_0_3px_rgba(217,119,6,0.06)]">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-800">
          ✦ Zenith Reference
        </div>

        {!zenith ? (
          <div className="mt-4 space-y-3 animate-pulse">
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-full rounded bg-gray-100" />
            <div className="h-3 w-5/6 rounded bg-gray-100" />
            <div className="h-3 w-4/6 rounded bg-gray-100" />
          </div>
        ) : (
          <div className="mt-4">
            <h3 className="text-lg font-extrabold leading-snug">{zenith.topic}</h3>
            <p className="text-sm text-gray-500 italic mt-0.5">{zenith.tagline}</p>

            {(() => {
              const fresh = zenith.nodes.filter((n) => gapState(n.reinforcement) === "fresh").length;
              const due = zenith.nodes.filter((n) => gapState(n.reinforcement) === "due").length;
              return (
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {fresh} of {zenith.nodes.length} reinforced
                  {due > 0 && <span className="text-amber-600"> · {due} due for review</span>}
                </p>
              );
            })()}

            <div className="mt-5 flex flex-col gap-5">
              {Array.from(new Set(zenith.nodes.map((n) => n.phaseTitle))).map((phaseTitle) => (
                <div key={phaseTitle}>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                    {phaseTitle}
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {zenith.nodes
                      .filter((n) => n.phaseTitle === phaseTitle)
                      .map((node) => (
                        <li key={node.id} className="text-sm">
                          <div className="flex items-center gap-1.5">
                            <GapDot node={node} />
                            <div className="font-semibold text-gray-800">{node.label}</div>
                          </div>
                          <div className="mt-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                              Structure{" "}
                            </span>
                            <span className="text-xs text-gray-600">{node.structure}</span>
                          </div>
                          <div className="mt-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                              Function{" "}
                            </span>
                            <span className="text-xs text-gray-600">{node.behavior}</span>
                          </div>
                          {node.equation && (
                            <div className="mt-1 rounded-md bg-gray-900 px-2 py-1 font-mono text-[11px] text-green-300 overflow-x-auto">
                              {node.equation}
                            </div>
                          )}
                          {node.marketImplementation && (
                            <div className="mt-1 text-xs text-green-700">
                              <span className="font-bold uppercase tracking-wide text-[10px] text-green-600">
                                In the market now{" "}
                              </span>
                              {node.marketImplementation}
                            </div>
                          )}
                          <div className="text-xs text-amber-700 italic mt-0.5">{node.insight}</div>
                          <NoteCapture
                            notes={node.notes}
                            onAdd={(text) => addZenithNodeNote(zenith.topicSlug, node.id, text)}
                            compact
                          />
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
