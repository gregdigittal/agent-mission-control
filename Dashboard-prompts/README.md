# Agent Mission Control — Build Prompts Package

This directory contains everything needed to build Agent Mission Control from scratch using Claude Code.

## Files

```
├── FUNCTIONAL_SPEC.md              # Full project context (READ THIS FIRST)
├── BACKLOG.md                      # 127-item prioritized development backlog
├── README.md                       # This file
└── prompts/
    ├── PROMPT_01_DASHBOARD_MVP.md  # Personal dashboard (HTML, mobile + ultrawide)
    ├── PROMPT_02_HYBRID_BRIDGE.md  # Orchestration bridge (Node.js, filesystem IPC)
    ├── PROMPT_03_REACT_DASHBOARD.md # Open-source React dashboard (Vercel + Supabase)
    ├── PROMPT_04_MULTI_VPS.md      # Multi-VPS orchestration (SSH)
    ├── PROMPT_05_MCP_SERVER.md     # MCP server for Claude Code integration
    └── PROMPT_06_ARCHITECTURE_DOCS.md # Architecture ADR + security + contributing
```

## How to Use

### Step 1: Read the Functional Spec
Every Claude Code session should start by reading `FUNCTIONAL_SPEC.md`. It provides the complete project context: architecture, database schema (already deployed), design system, data flows, and acceptance criteria.

### Step 2: Execute Prompts in Order

| Order | Prompt | What It Builds | Can Parallelize? |
|-------|--------|----------------|-----------------|
| 1 | PROMPT_01 | Personal dashboard (your tool, ships first) | — |
| 2a | PROMPT_02 | Bridge script | ✅ Parallel with 2b |
| 2b | PROMPT_03 | React dashboard | ✅ Parallel with 2a |
| 3 | PROMPT_04 | Multi-VPS extension | After PROMPT_02 |
| 4 | PROMPT_05 | MCP server | After PROMPT_02 |
| 5 | PROMPT_06 | Architecture docs | After all others |

### Step 3: Feed to Claude Code

For each prompt, SSH into your VPS and:

```bash
ssh hetzner-agents
cd ~/agent-mission-control
claude
```

Then paste: "Read FUNCTIONAL_SPEC.md first, then execute PROMPT_0X_*.md"

### Agent Team Recommendation

- **Prompts 01, 02, 04, 05, 06:** Single Claude Code session each
- **Prompt 03 (React Dashboard):** 3-agent team recommended:
  - Lead: Architecture, integration, component planning
  - Frontend: React components, Tailwind, animations, mobile layout
  - Backend: Supabase integration, Zustand stores, realtime subscriptions

## Supabase Status

**Project:** `agent-mission-control` (`zpsnbogldtepmfwgqarz`)
**Region:** eu-west-1
**Schema:** ✅ Fully deployed (9 tables, RLS, triggers, realtime)

Tables: `profiles`, `projects`, `agent_sessions`, `agents`, `events`, `kanban_tasks`, `vps_nodes`, `model_configs`, `approval_queue`

## Timeline Estimate

- **Week 1:** PROMPT_01 → working personal dashboard (ultrawide + mobile)
- **Week 2:** PROMPT_02 + PROMPT_03 start → bridge + React dashboard
- **Week 3:** PROMPT_03 complete → full OSS dashboard
- **Week 4:** PROMPT_04 + PROMPT_05 → multi-VPS + MCP
- **Week 5:** PROMPT_06 → docs → open-source launch
