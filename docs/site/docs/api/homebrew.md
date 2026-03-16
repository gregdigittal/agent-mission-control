---
id: homebrew
title: Homebrew Install
sidebar_position: 3
---

# Installing agent-mc via Homebrew

The `agent-mc` CLI (the Agent Mission Control MCP server) can be installed on macOS and Linux using [Homebrew](https://brew.sh).

## Prerequisites

- [Homebrew](https://brew.sh) 3.0 or later
- Node.js 20 or later (installed automatically as a dependency)

## Install

```bash
# Tap the Agent Mission Control repository
brew tap YOUR_ORG/agent-mission-control https://github.com/YOUR_ORG/agent-mission-control

# Install agent-mc
brew install agent-mc
```

> Replace `YOUR_ORG` with the actual GitHub organisation or user that hosts the tap.

## Verify the install

```bash
agent-mc --version
```

## Upgrade

```bash
brew upgrade agent-mc
```

## Uninstall

```bash
brew uninstall agent-mc
```

## Configuration

After installing, configure Claude Code to use `agent-mc` as an MCP server. Add an entry to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "agent-mission-control": {
      "command": "agent-mc",
      "env": {
        "AGENT_MC_AGENT_KEY": "default",
        "AGENT_MC_SESSION_ID": "your-session-id",
        "AGENT_MC_STATE_DIR": "~/.agent-mc"
      }
    }
  }
}
```

See the [MCP Server documentation](../../../mcp-server/README.md) for the full list of environment variables.

## Maintaining the Formula

The Homebrew formula lives at `Formula/agent-mc.rb` in this repository.

To update it for a new release:

1. Create a GitHub release and upload a source tarball of the `mcp-server/` directory.
2. Compute the SHA-256 checksum: `curl -sL <tarball-url> | sha256sum | awk '{print $1}'`
3. Update the `url` and `sha256` fields in `Formula/agent-mc.rb`.
4. Bump the `version` field to match the release tag.
5. Commit and push — Homebrew picks up the change automatically on the next `brew update`.
