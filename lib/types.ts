export interface ArchitecturePhase {
  id: string;
  title: string;
  summary: string;
}

export interface ArchitectureNode {
  id: string;
  phaseId: string;
  label: string;
  description: string;
  prereqIds: string[];
  completed: boolean;
  completedAt: string | null;
}

export interface NodeReference {
  title: string;
  url: string;
  why: string;
}

export interface ArchitectureMap {
  id: string;
  topic: string;
  slug: string;
  phases: ArchitecturePhase[];
  nodes: ArchitectureNode[];
  references: Record<string, NodeReference[]>;
  createdAt: string;
  updatedAt: string;
}

export type NodeStatus = "locked" | "ready" | "completed";

export interface ChallengeChoice {
  label: string;
  consequence: string;
  warning: string | null;
  clean: boolean;
}

export interface ChallengeStage {
  id: string;
  prompt: string;
  controlledFactors: string[];
  uncontrolledFactors: string[];
  choices: ChallengeChoice[];
}

export interface Challenge {
  id: string;
  subtopicLabel: string;
  title: string;
  setup: string;
  stages: ChallengeStage[];
}

export interface StageState {
  stageId: string;
  status: "pending" | "answered";
  pickedLabel: string | null;
  consequence: string | null;
  warning: string | null;
  clean: boolean | null;
}

export interface ChallengeRun {
  id: string;
  challenge: Challenge;
  stageStates: StageState[];
  finished: boolean;
  clean: boolean;
  updatedAt: string;
}
