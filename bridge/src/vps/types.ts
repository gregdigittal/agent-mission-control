// VPS orchestration types for multi-node agent deployment

export interface VpsConfig {
  id: string;
  label: string;
  host: string;
  user: string;
  sshKeyPath: string;
  port: number;
  region?: string;
  registeredAt: string;
  /** Current number of running agents on this node (updated by bridge) */
  agentCount?: number;
  /** Max agents this node can host (set at registration) */
  agentCapacity?: number;
}

export interface VpsRegistry {
  vps: VpsConfig[];
  updatedAt: string;
}

export type SshResultStatus = 'ok' | 'error' | 'timeout' | 'connection_refused';

export interface SshResult {
  status: SshResultStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
}

export type AllowedRemoteCommand =
  | 'uptime'
  | 'df'
  | 'free'
  | 'ps'
  | 'systemctl'
  | 'journalctl'
  | 'cat';

export interface RemoteCommand {
  command: AllowedRemoteCommand;
  args?: string[];
}

export type HeartbeatStatus = 'ok' | 'timeout' | 'unreachable';

export interface HeartbeatResult {
  vpsId: string;
  host: string;
  status: HeartbeatStatus;
  latencyMs: number;
  checkedAt: string;
  error?: string;
}
