"use client";

import { useEffect, useState, type RefObject } from "react";
import type { ArchitectureNode } from "@/lib/types";

interface LinePath {
  d: string;
  completed: boolean;
}

export function DependencyLines({
  nodes,
  containerRef,
}: {
  nodes: ArchitectureNode[];
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [paths, setPaths] = useState<LinePath[]>([]);

  useEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;

      const next: LinePath[] = [];
      nodes.forEach((node) => {
        node.prereqIds.forEach((prereqId) => {
          const fromEl = document.getElementById(`node-${prereqId}`);
          const toEl = document.getElementById(`node-${node.id}`);
          if (!(fromEl instanceof HTMLElement) || !(toEl instanceof HTMLElement)) return;

          const x1 = fromEl.offsetLeft + fromEl.offsetWidth;
          const y1 = fromEl.offsetTop + fromEl.offsetHeight / 2;
          const x2 = toEl.offsetLeft;
          const y2 = toEl.offsetTop + toEl.offsetHeight / 2;
          const midX = (x1 + x2) / 2;

          const prereqNode = nodes.find((n) => n.id === prereqId);
          const completed = Boolean(prereqNode?.completed && node.completed);

          next.push({ d: `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`, completed });
        });
      });
      setPaths(next);
    }

    const raf = requestAnimationFrame(recompute);
    window.addEventListener("resize", recompute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", recompute);
    };
  }, [nodes, containerRef]);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10" style={{ overflow: "visible" }}>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke={p.completed ? "#16a34a" : "#d1d5db"}
          strokeWidth={2}
          fill="none"
        />
      ))}
    </svg>
  );
}
