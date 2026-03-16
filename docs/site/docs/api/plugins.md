---
id: plugins
title: Plugin API
sidebar_position: 2
---

# Plugin API

The Agent Mission Control MCP server supports a plugin system that lets you add custom tools without modifying the core server codebase.

## The AgentPlugin Interface

Every plugin must export a default object that satisfies the `AgentPlugin` interface:

```ts
interface AgentPlugin {
  /** Unique identifier for this plugin, used in log output. */
  name: string;
  /** Semantic version string (e.g. "1.0.0"). */
  version: string;
  /** Human-readable description shown in startup logs. */
  description: string;
  /** One or more tools this plugin contributes to the MCP server. */
  tools: PluginTool[];
}

interface PluginTool {
  /** Tool name as it will appear to Claude Code (e.g. "my_custom_tool"). */
  name: string;
  /** Tool description shown to the model. */
  description: string;
  /** JSON Schema describing the tool's input (used for documentation). */
  inputSchema: Record<string, unknown>;
  /** Called by the MCP server when the tool is invoked. */
  handler: (input: unknown) => Promise<unknown>;
}
```

## Hello World Example

Create a file named `hello.plugin.js` in your `PLUGIN_DIR`:

```js
// hello.plugin.js
export default {
  name: 'hello-world',
  version: '1.0.0',
  description: 'Example plugin that echoes a greeting.',
  tools: [
    {
      name: 'hello_world',
      description: 'Returns a greeting message.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name to greet' },
        },
        required: ['name'],
      },
      handler: async (input) => {
        const { name } = input;
        return `Hello, ${name}! This message is from the hello-world plugin.`;
      },
    },
  ],
};
```

## How to Install a Plugin

1. Build your plugin to a `.plugin.js` file (plain JavaScript, ESM format).
2. Copy the file to your `PLUGIN_DIR` directory (default: `./plugins` relative to where the MCP server runs).
3. Restart the MCP server — it reads plugins at startup only.

```bash
# Example: using the default plugin directory
cp my-custom.plugin.js ./plugins/

# Or point PLUGIN_DIR to a custom location
PLUGIN_DIR=/path/to/my/plugins node dist/index.js
```

## Plugin Loading Behaviour

- The loader scans for `*.plugin.js` files in `PLUGIN_DIR` using `node:fs/promises`.
- Each file is loaded via dynamic `import()`.
- Plugins that fail to import, or whose exports do not match the `AgentPlugin` shape, are **skipped with a warning** — they never crash the server.
- A `[plugin:loaded]` log entry is emitted to stderr for each successfully registered plugin.

## Validation Rules

A plugin export is considered valid if it has:

- `name` — non-empty string
- `version` — non-empty string
- `description` — string (may be empty)
- `tools` — array (may be empty)

Each tool's `handler` is called with the raw input passed to the MCP tool call. Your handler is responsible for validating its own input.

## Security Notes

- Plugins run in the same Node.js process as the MCP server — trust only plugins from known sources.
- There is no sandbox; a plugin can access the filesystem and make network calls.
- `PLUGIN_DIR` defaults to `./plugins` in the working directory — ensure this path is not world-writable in production deployments.
