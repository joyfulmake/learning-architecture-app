import type { ReinforcementState } from "./types";

// The Leitner box system (Leitner, 1972): a small set of fixed review
// intervals, one box per interval. A well recalled item moves to a longer
// interval, a poorly recalled one drops back to the shortest, so review
// spacing tracks how solid a rep actually was instead of everyone getting the
// same fixed schedule. This is the same mechanism under Anki's card
// scheduling, just five numbers, no network call, no model involved.
// Index 0 is unused (boxLevel 0 is the "never reinforced" sentinel).
const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;

export function initialReinforcement(): ReinforcementState {
  return { boxLevel: 0, timesReinforced: 0, lastPracticedAt: null, dueAt: null };
}

// Called once per completed practice-and-check rep. Promotes a box on a pass
// (longer gap before it needs review again), resets to box 1 on a miss (it
// wasn't solid, review it again soon).
export function reinforce(current: ReinforcementState, passed: boolean, now = new Date()): ReinforcementState {
  const boxLevel = passed ? Math.min(current.boxLevel + 1, MAX_BOX) : 1;
  const dueAt = new Date(now.getTime() + BOX_INTERVAL_DAYS[boxLevel] * 24 * 60 * 60 * 1000).toISOString();
  return {
    boxLevel,
    timesReinforced: current.timesReinforced + 1,
    lastPracticedAt: now.toISOString(),
    dueAt,
  };
}

export type GapState = "gap" | "due" | "fresh";

// gap: never reinforced. due: reinforced before, but its box interval has
// elapsed, it's owed a review. fresh: reinforced recently, not yet due.
export function gapState(r: ReinforcementState, now = new Date()): GapState {
  if (r.boxLevel === 0 || !r.dueAt) return "gap";
  return new Date(r.dueAt).getTime() <= now.getTime() ? "due" : "fresh";
}

// Which zenith node should a just-completed rep reinforce? Untouched nodes
// come first, building initial coverage across the map. Once everything has
// been touched at least once, the most overdue node is reinforced next, which
// is what actually spaces reps out over real time instead of letting whichever
// node happens to align with the current implementation dominate.
export function pickNodeToReinforce<T extends { id: string; reinforcement: ReinforcementState }>(
  nodes: T[],
): string | null {
  if (nodes.length === 0) return null;

  const untouched = nodes.find((n) => n.reinforcement.boxLevel === 0);
  if (untouched) return untouched.id;

  const mostOverdue = nodes.reduce((most, n) => {
    const mostDue = most.reinforcement.dueAt ? new Date(most.reinforcement.dueAt).getTime() : 0;
    const nDue = n.reinforcement.dueAt ? new Date(n.reinforcement.dueAt).getTime() : 0;
    return nDue < mostDue ? n : most;
  });
  return mostOverdue.id;
}
