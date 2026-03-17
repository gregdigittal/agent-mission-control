/**
 * Unit tests — MCP server plugin registry.
 *
 * Tests cover:
 * - registerPlugin registers each tool with the MCP server
 * - Handler is wrapped correctly — result is returned as MCP content block
 * - Handler that returns a non-string value is JSON-stringified
 * - Plugin with no tools registers nothing but emits a log entry
 * - Log entry is emitted to stderr for each registered plugin
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerPlugin } from './registry.js';
import type { AgentPlugin, PluginTool } from './types.js';

// ── Mock McpServer ─────────────────────────────────────────────────────────

function makeMockServer() {
  return {
    registerTool: vi.fn(),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTool(overrides: Partial<PluginTool> = {}): PluginTool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: {},
    handler: async (_input: unknown) => 'ok',
    ...overrides,
  };
}

function makePlugin(tools: PluginTool[] = [], overrides: Partial<AgentPlugin> = {}): AgentPlugin {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'Test plugin',
    tools,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('registerPlugin — tool registration', () => {
  it('calls server.registerTool once per plugin tool', () => {
    const server = makeMockServer();
    const plugin = makePlugin([makeTool({ name: 'tool_a' }), makeTool({ name: 'tool_b' })]);

    registerPlugin(plugin, server as never);

    expect(server.registerTool).toHaveBeenCalledTimes(2);
    expect(server.registerTool.mock.calls[0][0]).toBe('tool_a');
    expect(server.registerTool.mock.calls[1][0]).toBe('tool_b');
  });

  it('does not call registerTool when plugin has no tools', () => {
    const server = makeMockServer();
    registerPlugin(makePlugin([]), server as never);
    expect(server.registerTool).not.toHaveBeenCalled();
  });

  it('passes the tool description to registerTool', () => {
    const server = makeMockServer();
    const tool = makeTool({ name: 'greet', description: 'Says hello' });
    registerPlugin(makePlugin([tool]), server as never);
    const [, meta] = server.registerTool.mock.calls[0] as [string, { description: string }];
    expect(meta.description).toBe('Says hello');
  });
});

describe('registerPlugin — handler wrapping', () => {
  it('wrapped handler returns a text content block with the handler result', async () => {
    const server = makeMockServer();
    const tool = makeTool({ handler: async () => 'hello world' });
    registerPlugin(makePlugin([tool]), server as never);

    // Extract the wrapped handler registered with the server
    const [, , wrappedHandler] = server.registerTool.mock.calls[0] as [
      string,
      unknown,
      (args: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>,
    ];

    const result = await wrappedHandler({});
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('hello world');
  });

  it('JSON-stringifies non-string handler results', async () => {
    const server = makeMockServer();
    const tool = makeTool({ handler: async () => ({ status: 'ok', count: 3 }) });
    registerPlugin(makePlugin([tool]), server as never);

    const [, , wrappedHandler] = server.registerTool.mock.calls[0] as [
      string,
      unknown,
      (args: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>,
    ];

    const result = await wrappedHandler({});
    expect(result.content[0].text).toBe(JSON.stringify({ status: 'ok', count: 3 }, null, 2));
  });

  it('passes args.input to the plugin handler when present', async () => {
    const server = makeMockServer();
    const handlerSpy = vi.fn().mockResolvedValue('done');
    const tool = makeTool({ handler: handlerSpy });
    registerPlugin(makePlugin([tool]), server as never);

    const [, , wrappedHandler] = server.registerTool.mock.calls[0] as [
      string,
      unknown,
      (args: { input?: unknown }) => Promise<unknown>,
    ];

    await wrappedHandler({ input: { name: 'Greg' } });
    expect(handlerSpy).toHaveBeenCalledWith({ name: 'Greg' });
  });

  it('passes the full args object when input field is absent', async () => {
    const server = makeMockServer();
    const handlerSpy = vi.fn().mockResolvedValue('done');
    const tool = makeTool({ handler: handlerSpy });
    registerPlugin(makePlugin([tool]), server as never);

    const [, , wrappedHandler] = server.registerTool.mock.calls[0] as [
      string,
      unknown,
      (args: { input?: unknown }) => Promise<unknown>,
    ];

    await wrappedHandler({ input: undefined });
    expect(handlerSpy).toHaveBeenCalledWith({ input: undefined });
  });
});

describe('registerPlugin — stderr log', () => {
  it('writes a [plugin:loaded] entry to stderr for each registered plugin', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const plugin = makePlugin([makeTool({ name: 'my_tool' })], { name: 'my-plugin', version: '3.0.0' });
    const server = makeMockServer();

    registerPlugin(plugin, server as never);

    const logged = stderrSpy.mock.calls.map((c) => c[0] as string).join('');
    expect(logged).toContain('[plugin:loaded]');
    expect(logged).toContain('my-plugin');
    expect(logged).toContain('3.0.0');
    expect(logged).toContain('my_tool');

    stderrSpy.mockRestore();
  });
});
