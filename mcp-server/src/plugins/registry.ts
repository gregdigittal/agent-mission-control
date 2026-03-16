import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AgentPlugin } from './types.js';

/**
 * Registers all tools from a plugin with the MCP server.
 * Logs a [plugin:loaded] entry for each successfully registered plugin.
 */
export function registerPlugin(plugin: AgentPlugin, server: McpServer): void {
  for (const tool of plugin.tools) {
    // Wrap the plugin's inputSchema in a zod passthrough so the MCP SDK
    // accepts it. The plugin handler is responsible for its own input validation.
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: { input: z.unknown().describe('Plugin tool input') },
      },
      async (args: { input?: unknown }) => {
        const result = await tool.handler(args.input ?? args);
        return {
          content: [
            {
              type: 'text' as const,
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      },
    );
  }

  process.stderr.write(
    `[plugin:loaded] name=${plugin.name} version=${plugin.version} tools=${plugin.tools.map((t) => t.name).join(',')}\n`,
  );
}
