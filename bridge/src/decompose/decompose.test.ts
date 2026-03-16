import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK — no real API calls in tests.
vi.mock('@anthropic-ai/sdk');

// Mock the audit logger to avoid filesystem side effects.
vi.mock('../audit/logger.js', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTextResponse(text: string) {
  return {
    id: 'msg_test',
    type: 'message' as const,
    role: 'assistant' as const,
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn' as const,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'text' as const, text }],
  };
}

function mockAnthropicCreate(response: ReturnType<typeof makeTextResponse>) {
  const createMock = vi.fn().mockResolvedValue(response);
  vi.mocked(Anthropic).mockImplementation(() => ({
    messages: { create: createMock },
  }) as unknown as Anthropic);
  return createMock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('decompose()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
  });

  it('parses a valid JSON response into Subtask[]', async () => {
    const subtaskJson = JSON.stringify([
      {
        id: 'setup',
        title: 'Set up environment',
        description: 'Install deps',
        estimatedTurns: 2,
        dependsOn: [],
      },
      {
        id: 'implement',
        title: 'Implement feature',
        description: 'Write the code',
        estimatedTurns: 5,
        dependsOn: ['setup'],
      },
    ]);

    mockAnthropicCreate(makeTextResponse(subtaskJson));

    const { decompose } = await import('./decompose.js');
    const result = await decompose({
      objective: 'Build a REST API',
      sessionId: 'sess-1',
      agentKey: 'backend',
    });

    expect(result.subtasks).toHaveLength(2);
    expect(result.subtasks[0]).toMatchObject({
      id: 'setup',
      title: 'Set up environment',
      description: 'Install deps',
      estimatedTurns: 2,
      dependsOn: [],
    });
    expect(result.subtasks[1]).toMatchObject({
      id: 'implement',
      dependsOn: ['setup'],
    });
  });

  it('returns an empty array without throwing when the response is malformed JSON', async () => {
    mockAnthropicCreate(makeTextResponse('this is not json {{{'));

    const { decompose } = await import('./decompose.js');
    const result = await decompose({
      objective: 'Do something',
      sessionId: 'sess-2',
      agentKey: 'lead',
    });

    expect(result.subtasks).toHaveLength(0);
    expect(result.rawResponse).toBe('this is not json {{{');
  });

  it('returns an empty array and does not throw when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env['ANTHROPIC_API_KEY'];

    const { decompose } = await import('./decompose.js');
    const result = await decompose({
      objective: 'Some objective',
      sessionId: 'sess-3',
      agentKey: 'frontend',
    });

    expect(result.subtasks).toHaveLength(0);
    expect(result.rawResponse).toBe('');
    // Anthropic constructor should not have been called
    expect(vi.mocked(Anthropic)).not.toHaveBeenCalled();
  });

  it('handles subtasks with missing optional fields gracefully', async () => {
    // Subtask missing estimatedTurns and dependsOn — should still be included with defaults
    const partialJson = JSON.stringify([
      { id: 'task-a', title: 'Task A', description: 'Do A' },
    ]);

    mockAnthropicCreate(makeTextResponse(partialJson));

    const { decompose } = await import('./decompose.js');
    const result = await decompose({
      objective: 'Small objective',
      sessionId: 'sess-4',
      agentKey: 'backend',
    });

    expect(result.subtasks).toHaveLength(1);
    expect(result.subtasks[0]).toMatchObject({
      id: 'task-a',
      title: 'Task A',
      description: 'Do A',
      estimatedTurns: 1, // default when missing
      dependsOn: [],     // default when missing
    });
  });

  it('skips subtask entries that are missing required id, title, or description', async () => {
    const mixedJson = JSON.stringify([
      { id: 'valid', title: 'Valid Task', description: 'Valid', estimatedTurns: 3, dependsOn: [] },
      { title: 'Missing id', description: 'No id field' },  // missing id
      { id: 'no-title', description: 'No title field' },    // missing title
    ]);

    mockAnthropicCreate(makeTextResponse(mixedJson));

    const { decompose } = await import('./decompose.js');
    const result = await decompose({
      objective: 'Mixed objective',
      sessionId: 'sess-5',
      agentKey: 'backend',
    });

    // Only the entry with all three required fields passes
    expect(result.subtasks).toHaveLength(1);
    expect(result.subtasks[0]?.id).toBe('valid');
  });

  it('returns an empty array when Claude returns a non-array JSON value', async () => {
    mockAnthropicCreate(makeTextResponse('{"unexpected": "object"}'));

    const { decompose } = await import('./decompose.js');
    const result = await decompose({
      objective: 'Object objective',
      sessionId: 'sess-6',
      agentKey: 'backend',
    });

    expect(result.subtasks).toHaveLength(0);
  });
});
