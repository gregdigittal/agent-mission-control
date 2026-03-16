export type Subtask = {
  id: string;
  title: string;
  description: string;
  estimatedTurns: number;
  dependsOn: string[];
};

export type DecomposeRequest = {
  objective: string;
  sessionId: string;
  agentKey: string;
};

export type DecomposeResult = {
  subtasks: Subtask[];
  rawResponse: string;
};
