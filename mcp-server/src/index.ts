#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerStatusTools } from './tools/status.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerApprovalTools } from './tools/approvals.js';
import { registerEventTools } from './tools/events.js';
import { registerMessagingTools } from './tools/messaging.js';
import { AGENT_KEY, SESSION_ID, STATE_DIR } from './config.js';
import { loadPlugins } from './plugins/loader.js';
import { registerPlugin } from './plugins/registry.js';

const server = new McpServer({
  name: 'agent-mission-control',
  version: '0.1.0',
});

// Register all 10 tools
registerStatusTools(server);
registerTaskTools(server);
registerApprovalTools(server);
registerEventTools(server);
registerMessagingTools(server);

async function main(): Promise<void> {
  // Load and register plugins before connecting transport
  const pluginDir = process.env['PLUGIN_DIR'] ?? './plugins';
  const plugins = await loadPlugins(pluginDir);
  for (const plugin of plugins) {
    registerPlugin(plugin, server);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup to stderr (stdout is reserved for MCP protocol)
  process.stderr.write(
    `[agent-mc] MCP server started — agent=${AGENT_KEY} session=${SESSION_ID} stateDir=${STATE_DIR} plugins=${plugins.length}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[agent-mc] Fatal error: ${err}\n`);
  process.exit(1);
});
