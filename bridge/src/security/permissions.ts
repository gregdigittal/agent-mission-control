import { loadConfig } from '../config.js';

export interface AgentPermissions {
  toolAllowlist: string[];
  directoryScope: string[];
}

export async function getPermissionsForRole(role: string): Promise<AgentPermissions> {
  const config = await loadConfig();
  const roleConfig = config.agent_roles[role];

  if (roleConfig) {
    return {
      toolAllowlist: roleConfig.tool_allowlist,
      directoryScope: roleConfig.directory_scope,
    };
  }

  // Fall back to defaults
  return {
    toolAllowlist: config.agent_defaults.tool_allowlist,
    directoryScope: ['/'],
  };
}

export function buildAllowedToolsArg(tools: string[]): string {
  return tools.join(',');
}
