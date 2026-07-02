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

// Zenith reference — persistent sidebar content, one per topic, non-interactive
export interface ZenithNode {
  id: string;
  phaseTitle: string;
  label: string;
  insight: string;
}

export interface ZenithReference {
  topicSlug: string;
  topic: string;
  tagline: string;
  nodes: ZenithNode[];
  generatedAt: string;
}

// Challenges — 10 generated implementation scenarios per topic
export interface Implementation {
  id: string;
  topicSlug: string;
  title: string;
  angle: string;
  blurb: string;
}

// One iteration = one factor-shaped practice rep + its 5-question check
export interface IterationPracticeChoice {
  label: string;
  consequence: string;
  warning: string | null;
  clean: boolean;
}

export interface IterationPractice {
  prompt: string;
  controlledFactors: string[];
  uncontrolledFactors: string[];
  choices: IterationPracticeChoice[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface QuizAttempt {
  answers: (number | null)[];
  correctCount: number;
  attemptedAt: string;
}

export type IterationStatus = "pending" | "practiced" | "quizzed";

export interface IterationState {
  index: number;
  factor: string;
  practice: IterationPractice;
  pickedLabel: string | null;
  practiceConsequence: string | null;
  practiceWarning: string | null;
  practiceClean: boolean | null;
  quiz: QuizQuestion[];
  attempts: QuizAttempt[];
  status: IterationStatus;
}

export interface ImplementationRun {
  id: string;
  implementation: Implementation;
  totalIterations: number;
  iterations: IterationState[];
  currentIterationIndex: number;
  finished: boolean;
  updatedAt: string;
}
