## Project Scope Override

This project is Mission Control (HTML/Node/Supabase). Ignore all global rules that are scoped to the Social Media Agent project, specifically:

- `~/.claude/rules/architecture.md` (SMA-specific: Slack/MCP/TypeScript pipeline)
- `~/.claude/rules/project-conventions.md` (SMA-specific: TypeScript ESM, Node16, MCP client patterns)
- `~/.claude/rules/review-gate-extensions.md` (SMA-specific: Slack safety, MCP resilience, Instagram image rules)

Use only the project rules in this directory plus the following global rules:
`agents.md`, `coding-style.md`, `git-workflow.md`, `model-delegation.md`, `performance.md`, `review-gate.md`, `security.md`, `testing.md`.
