import Anthropic from '@anthropic-ai/sdk';
import { audit } from '../audit/logger.js';
import type { DecomposeRequest, DecomposeResult, Subtask } from './types.js';

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a task decomposition assistant. Given an objective, break it down into a list of concrete subtasks.

Return ONLY a valid JSON array with no surrounding text, markdown, or code fences. Each element must have exactly these fields:
- "id": a short kebab-case identifier (string)
- "title": a brief task title (string)
- "description": a clear description of what needs to be done (string)
- "estimatedTurns": estimated conversation turns to complete (number, 1–20)
- "dependsOn": array of task ids this task depends on (string[], may be empty)

Example output:
[{"id":"setup-env","title":"Set up environment","description":"Install dependencies and configure .env","estimatedTurns":2,"dependsOn":[]},{"id":"write-tests","title":"Write unit tests","description":"Write failing tests for the feature","estimatedTurns":5,"dependsOn":["setup-env"]}]`;

/**
 * Decompose an objective into subtasks using Claude.
 *
 * ANTHROPIC_API_KEY must be set in the environment.
 * The function is intentionally defensive — if Claude returns malformed JSON,
 * it logs the error and returns an empty subtask list rather than throwing.
 */
export async function decompose(request: DecomposeRequest): Promise<DecomposeResult> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    const message = 'ANTHROPIC_API_KEY is not set — decompose_objective command is unavailable';
    console.error(`[decompose] ${message}`);
    await audit('decompose_error', {
      sessionId: request.sessionId,
      agentKey: request.agentKey,
      error: message,
    });
    return { subtasks: [], rawResponse: '' };
  }

  const client = new Anthropic({ apiKey });

  let rawResponse = '';

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Decompose the following objective into subtasks:\n\n${request.objective}`,
        },
      ],
    });

    // Extract text content from the first content block
    const firstBlock = message.content[0];
    rawResponse = firstBlock?.type === 'text' ? firstBlock.text : '';

    const subtasks = parseSubtasks(rawResponse);

    await audit('decompose_complete', {
      sessionId: request.sessionId,
      agentKey: request.agentKey,
      subtaskCount: subtasks.length,
      objective: request.objective.slice(0, 100),
    });

    return { subtasks, rawResponse };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[decompose] Claude API call failed: ${message}`);
    await audit('decompose_error', {
      sessionId: request.sessionId,
      agentKey: request.agentKey,
      error: message,
      rawResponse,
    });
    return { subtasks: [], rawResponse };
  }
}

/**
 * Parse the raw Claude response into a Subtask array.
 * Returns an empty array on any parse or validation error — never throws.
 */
function parseSubtasks(raw: string): Subtask[] {
  if (!raw.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    console.error('[decompose] Failed to parse JSON response from Claude');
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error('[decompose] Expected JSON array, got:', typeof parsed);
    return [];
  }

  const subtasks: Subtask[] = [];
  for (const item of parsed) {
    if (!isSubtaskLike(item)) {
      console.warn('[decompose] Skipping subtask with missing required fields:', JSON.stringify(item));
      continue;
    }
    subtasks.push({
      id: String(item.id),
      title: String(item.title),
      description: String(item.description),
      estimatedTurns: typeof item.estimatedTurns === 'number' ? item.estimatedTurns : 1,
      dependsOn: Array.isArray(item.dependsOn)
        ? item.dependsOn.filter((d): d is string => typeof d === 'string')
        : [],
    });
  }

  return subtasks;
}

function isSubtaskLike(item: unknown): item is Record<string, unknown> {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj['id'] !== 'undefined' &&
    typeof obj['title'] !== 'undefined' &&
    typeof obj['description'] !== 'undefined'
  );
}
