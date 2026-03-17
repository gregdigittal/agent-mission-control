/**
 * hello.plugin.js — Example Agent Mission Control plugin.
 *
 * Copy this file to your PLUGIN_DIR and restart the MCP server.
 * The server will pick up the `hello_world` tool automatically.
 *
 * Plugin contract:
 *   - Default export must satisfy the AgentPlugin interface (name, version, description, tools[])
 *   - Each tool needs: name, description, inputSchema (JSON Schema), handler (async fn)
 *   - The file must use ESM format (.plugin.js extension, loaded via dynamic import)
 *
 * See docs/api/plugins.md for the full API reference.
 */

/** @type {import('../src/plugins/types.js').AgentPlugin} */
export default {
  name: 'hello-world',
  version: '1.0.0',
  description: 'Example plugin — echoes a personalised greeting. Use as a template for new plugins.',
  tools: [
    {
      name: 'hello_world',
      description: 'Returns a greeting message. Useful for verifying the plugin system is working.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name to greet',
          },
        },
        required: ['name'],
      },
      handler: async (input) => {
        const { name } = /** @type {{ name: string }} */ (input);
        if (!name || typeof name !== 'string') {
          return 'Error: "name" must be a non-empty string.';
        }
        return `Hello, ${name}! This greeting was delivered by the hello-world plugin.`;
      },
    },
  ],
};
