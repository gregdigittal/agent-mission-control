import { readFile, readdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { COMMANDS_DIR, PROCESSED_DIR, reloadConfig } from '../config.js';
import { validateToken } from '../security/token.js';
import { audit } from '../audit/logger.js';
import { spawnAgent, agentProcesses } from './spawn.js';
import { terminateAgent } from './terminate.js';
import { handleApproval } from './approve.js';

// Payload schemas for each command type
const SpawnPayloadSchema = z.object({
  session_id: z.string(),
  agent_key: z.string(),
  role: z.string(),
  prompt: z.string().optional(),
  model: z.string().optional(),
  max_turns: z.number().optional(),
  env_vars: z.record(z.string()).optional(),
});

const TerminatePayloadSchema = z.object({
  session_id: z.string(),
  agent_key: z.string(),
  cleanup_worktree: z.boolean().optional(),
});

const ApprovePayloadSchema = z.object({
  session_id: z.string(),
  task_id: z.string(),
  approved: z.boolean(),
  rejection_reason: z.string().optional(),
});

const AgentRefPayloadSchema = z.object({
  session_id: z.string(),
  agent_key: z.string(),
});

const CommandSchema = z.object({
  id: z.string(),
  type: z.enum(['spawn_agent', 'terminate_agent', 'approve_task', 'update_config', 'pause_agent', 'resume_agent']),
  timestamp: z.string(),
  session_token: z.string(),
  payload: z.record(z.unknown()),
});

type Command = z.infer<typeof CommandSchema>;

export async function processCommands(): Promise<number> {
  let processed = 0;

  let files: string[];
  try {
    files = await readdir(COMMANDS_DIR);
  } catch {
    return 0;
  }

  const commandFiles = files.filter(f => f.startsWith('cmd_') && f.endsWith('.json'));

  for (const file of commandFiles) {
    const filePath = join(COMMANDS_DIR, file);
    try {
      const raw = JSON.parse(await readFile(filePath, 'utf-8'));
      const cmd = CommandSchema.parse(raw);

      // Validate session token
      const valid = await validateToken(cmd.session_token);
      if (!valid) {
        await audit('command_rejected', { commandId: cmd.id, reason: 'invalid_token', file });
        console.warn(`[commands] Rejected command ${cmd.id}: invalid token`);
        await moveToProcessed(filePath, file);
        continue;
      }

      await executeCommand(cmd);
      processed++;
    } catch (err) {
      await audit('command_error', { file, error: String(err) });
      console.error(`[commands] Error processing ${file}:`, err);
    }

    // Move to processed regardless of success/failure
    await moveToProcessed(filePath, file);
  }

  return processed;
}

async function executeCommand(cmd: Command): Promise<void> {
  await audit('command_received', { commandId: cmd.id, type: cmd.type });

  switch (cmd.type) {
    case 'spawn_agent': {
      const payload = SpawnPayloadSchema.parse(cmd.payload);
      await spawnAgent(payload);
      break;
    }

    case 'terminate_agent': {
      const payload = TerminatePayloadSchema.parse(cmd.payload);
      await terminateAgent(payload);
      break;
    }

    case 'approve_task': {
      const payload = ApprovePayloadSchema.parse(cmd.payload);
      await handleApproval(payload);
      break;
    }

    case 'pause_agent': {
      const payload = AgentRefPayloadSchema.parse(cmd.payload);
      const id = `${payload.session_id}:${payload.agent_key}`;
      const agent = agentProcesses.get(id);
      if (agent?.running && agent.process) {
        agent.process.kill('SIGSTOP');
        await audit('agent_paused', payload);
        console.log(`[commands] Paused agent ${payload.agent_key}`);
      }
      break;
    }

    case 'resume_agent': {
      const payload = AgentRefPayloadSchema.parse(cmd.payload);
      const id = `${payload.session_id}:${payload.agent_key}`;
      const agent = agentProcesses.get(id);
      if (agent?.running && agent.process) {
        agent.process.kill('SIGCONT');
        await audit('agent_resumed', payload);
        console.log(`[commands] Resumed agent ${payload.agent_key}`);
      }
      break;
    }

    case 'update_config':
      reloadConfig();
      await audit('config_reloaded', {});
      console.log('[commands] Config will reload on next loop');
      break;

    default:
      await audit('command_unknown', { commandId: cmd.id, type: cmd.type });
  }
}

async function moveToProcessed(filePath: string, fileName: string): Promise<void> {
  try {
    await rename(filePath, join(PROCESSED_DIR, fileName));
  } catch {
    // Ignore if file already moved/deleted
  }
}
