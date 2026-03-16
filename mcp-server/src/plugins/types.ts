export interface AgentPlugin {
  name: string;
  version: string;
  description: string;
  tools: PluginTool[];
}

export interface PluginTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: unknown) => Promise<unknown>;
}
