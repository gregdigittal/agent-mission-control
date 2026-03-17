/**
 * Writes IPC command JSON files to the bridge command directory.
 * The bridge polls this directory and executes queued commands.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const DEFAULT_COMMAND_DIR = '~/.agent-mc/commands';

function getCommandDir(): string {
  const raw = process.env['BRIDGE_COMMAND_DIR'] ?? DEFAULT_COMMAND_DIR;
  // Expand leading ~ to the home directory
  if (raw.startsWith('~/')) {
    const home = process.env['HOME'] ?? '/root';
    return resolve(join(home, raw.slice(2)));
  }
  return resolve(raw);
}

export interface SpawnCommand {
  type: 'spawn';
  commandId: string;
  objective: string;
  repoPath: string;
  model?: string;
  maxTurns?: number;
  createdAt: string;
}

export interface CreateTaskCommand {
  type: 'create_task';
  commandId: string;
  sessionId: string;
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  createdAt: string;
}

export interface TerminateCommand {
  type: 'terminate';
  commandId: string;
  sessionId: string;
  createdAt: string;
}

type BridgeCommand = SpawnCommand | CreateTaskCommand | TerminateCommand;

/**
 * Writes a command JSON file to the bridge IPC directory.
 * Returns the commandId used for the file name.
 */
export async function writeCommand(command: BridgeCommand): Promise<string> {
  const dir = getCommandDir();

  try {
    await mkdir(dir, { recursive: true });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST') {
      throw new Error(`Failed to create command directory: ${String(err)}`);
    }
  }

  const ts = Date.now();
  const rand = randomBytes(4).toString('hex');
  const filename = `cmd-${ts}-${rand}.json`;
  const filepath = join(dir, filename);

  const json = JSON.stringify(command, null, 2);

  try {
    await writeFile(filepath, json, { encoding: 'utf8', flag: 'wx' });
  } catch (err: unknown) {
    throw new Error(`Failed to write command file ${filepath}: ${String(err)}`);
  }

  return command.commandId;
}

/**
 * Generates a cryptographically random command ID.
 */
export function generateCommandId(): string {
  return randomBytes(16).toString('hex');
}
