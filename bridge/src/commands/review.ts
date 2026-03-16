import { loadConfig } from '../config.js';
import { audit } from '../audit/logger.js';
import { spawnAgent, agentProcesses } from './spawn.js';

/** In-memory map tracking review-loop retry counts per agent ID (session:key). */
const reviewRetryCount = new Map<string, number>();

export interface ReviewLoopPayload {
  session_id: string;
  agent_key: string;
  role: string;
  prompt?: string;
  model?: string;
  max_turns?: number;
}

/**
 * Re-queues an agent for another review pass.
 * Enforces `config.review_loop.max_retries` and appends the configured retry prompt suffix.
 * Returns true when the agent was successfully re-queued, false when the limit was reached.
 */
export async function triggerReviewLoop(payload: ReviewLoopPayload): Promise<boolean> {
  const config = await loadConfig();
  const id = `${payload.session_id}:${payload.agent_key}`;
  const retries = reviewRetryCount.get(id) ?? 0;
  const maxRetries = config.review_loop.max_retries;

  if (retries >= maxRetries) {
    await audit('review_loop_exhausted', {
      sessionId: payload.session_id,
      agentKey: payload.agent_key,
      retries,
      maxRetries,
    });
    console.warn(`[review] Agent ${payload.agent_key} exhausted ${maxRetries} review attempts`);
    reviewRetryCount.delete(id);
    return false;
  }

  // Terminate any lingering process for this agent before re-spawning
  const existing = agentProcesses.get(id);
  if (existing?.running) {
    await audit('review_loop_replacing_running', {
      sessionId: payload.session_id,
      agentKey: payload.agent_key,
      pid: existing.pid,
    });
  }

  const retryPrompt = payload.prompt
    ? `${payload.prompt}\n\n${config.review_loop.retry_prompt_suffix}`
    : config.review_loop.retry_prompt_suffix;

  reviewRetryCount.set(id, retries + 1);

  await spawnAgent({
    session_id: payload.session_id,
    agent_key: payload.agent_key,
    role: payload.role,
    prompt: retryPrompt,
    model: payload.model,
    max_turns: payload.max_turns,
  });

  await audit('review_loop_triggered', {
    sessionId: payload.session_id,
    agentKey: payload.agent_key,
    attempt: retries + 1,
    maxRetries,
  });

  console.log(`[review] Review loop for ${payload.agent_key}: attempt ${retries + 1}/${maxRetries}`);
  return true;
}

/** Resets the retry counter for an agent — call after a clean completion. */
export function resetReviewCount(sessionId: string, agentKey: string): void {
  reviewRetryCount.delete(`${sessionId}:${agentKey}`);
}

/** Returns the current review retry count for an agent (0 if never reviewed). */
export function getReviewCount(sessionId: string, agentKey: string): number {
  return reviewRetryCount.get(`${sessionId}:${agentKey}`) ?? 0;
}
