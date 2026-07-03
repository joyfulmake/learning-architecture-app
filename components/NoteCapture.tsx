"use client";

import { useState } from "react";
import type { Note } from "@/lib/types";

// A small, reused "your own addition" capture UI: existing notes plus an
// inline add form. Used at node level, phase level, and on zenith nodes, so
// captured additions live wherever the map does, not in one bolted-on place.
export function NoteCapture({
  notes,
  onAdd,
  compact = false,
}: {
  notes: Note[];
  onAdd: (text: string) => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setDraft("");
    setOpen(false);
  }

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      {notes.length > 0 && (
        <ul className="space-y-1">
          {notes.map((note) => (
            <li
              key={note.id}
              className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5"
            >
              {note.text}
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="mt-1.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Add your own note…"
            className="flex-1 min-w-0 rounded-full border-2 border-gray-300 px-3 py-1 text-xs focus:outline-none focus:border-green-500"
          />
          <button
            onClick={submit}
            className="shrink-0 px-3 py-1 rounded-full bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 transition"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="mt-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition"
        >
          + Add a note
        </button>
      )}
    </div>
  );
}
