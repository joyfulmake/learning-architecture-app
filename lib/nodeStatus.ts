import type { ArchitectureNode, NodeStatus } from "./types";

export function getNodeStatus(node: ArchitectureNode, allNodes: ArchitectureNode[]): NodeStatus {
  if (node.completed) return "completed";
  const prereqsMet = node.prereqIds.every((id) => allNodes.find((n) => n.id === id)?.completed);
  return prereqsMet ? "ready" : "locked";
}
