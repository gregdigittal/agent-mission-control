/**
 * Types for the parallel exploration (competing approaches) subsystem.
 */

export type ApproachStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type ExploreSessionStatus = 'running' | 'pending_approval' | 'winner_merged' | 'cancelled' | 'timeout';

export type Approach = {
  readonly id: string;           // approach-0, approach-1, …
  readonly description: string;  // human-readable approach description
  readonly sessionId: string;    // bridge session ID (explore-{timestamp})
  readonly agentKey: string;     // approach-{n}
  readonly worktreePath: string;
  status: ApproachStatus;
  startedAt: Date;
  completedAt?: Date;
};

export type ExploreSession = {
  readonly id: string;            // explore-{timestamp}
  readonly objective: string;
  readonly approaches: Approach[];
  status: ExploreSessionStatus;
  readonly startedAt: Date;
  readonly timeoutMs: number;
  completedAt?: Date;
  winnerId?: string;              // approach id of the winner
};

export type CompetitionResult = {
  readonly winnerId: string;
  readonly winnerApproach: Approach;
  readonly loserIds: readonly string[];
  readonly completedAt: Date;
};

export type ExploreParallelPayload = {
  readonly sessionId: string;     // parent session that issued the command
  readonly agentKey: string;      // parent agent
  readonly objective: string;
  readonly approaches: readonly string[];  // approach descriptions (1 per competing agent)
  readonly timeoutMs?: number;    // default: 30 minutes
};
