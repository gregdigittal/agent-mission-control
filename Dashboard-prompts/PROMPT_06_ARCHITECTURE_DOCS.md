# PROMPT 06: Architecture Document & Security Model

> **Prerequisites:** Read `FUNCTIONAL_SPEC.md` first. All prior prompts provide context.
> **Deliverables:** `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/CONTRIBUTING.md`, root `README.md`
> **Estimated effort:** 1 Claude Code session

---

## Objective

Produce the canonical architecture decision record, security model, contributing guide, and project README. These documents are the foundation for open-source contributors.

## Architecture Decision Record (`docs/ARCHITECTURE.md`)

### Required Sections

1. **System Overview** — Mermaid architecture diagram, component inventory, data flow
2. **Decision Log** — 12 ADRs, each with Title, Status, Context, Decision, Alternatives, Consequences:

| ADR | Title |
|-----|-------|
| 001 | Filesystem IPC over WebSockets |
| 002 | Supabase as primary database with self-host option |
| 003 | Git worktrees for agent isolation |
| 004 | Hybrid Bridge architecture (Option D) |
| 005 | Traffic light permission model |
| 006 | MCP server for bidirectional agent communication |
| 007 | Multi-VPS via SSH only |
| 008 | Single-file HTML for MVP vs React for OSS |
| 009 | Append-only events table for audit trail |
| 010 | Per-agent budget caps with database-level enforcement |
| 011 | Multi-model support with BYOK |
| 012 | CSS custom properties for screen-adaptive sizing |

3. **Data Model** — Mermaid ER diagram, table relationships, RLS strategy
4. **Deployment Architecture** — 3 modes (personal, cloud, self-hosted) with diagrams
5. **Integration Points** — Claude Code, Claude Agent SDK, MCP, SSH, Git, Supabase

## Security Model (`docs/SECURITY.md`)

Cover:
- Trust boundaries diagram
- Threat model (top 10 risks with mitigations)
- Credential handling (what's stored, what's not)
- Attack surface analysis
- RLS enforcement details
- Audit trail guarantees
- Post-OpenClaw design principles (what we explicitly avoid)
- Responsible disclosure process

## Contributing Guide (`docs/CONTRIBUTING.md`)

Cover:
- Dev environment setup (all 3 deployment modes)
- Code style and conventions
- PR process
- Testing expectations
- Architecture principles new code must follow
- Security requirements for contributions

## Root README (`README.md`)

Cover:
- Product description (2-3 sentences)
- Screenshot/GIF placeholder
- Quickstart for all 3 modes (personal MVP, cloud OSS, self-hosted)
- Feature highlights
- Architecture overview (brief)
- Links to detailed docs
- License (MIT)

## Acceptance Criteria

- [ ] 12 ADRs with context, decision, alternatives, consequences
- [ ] Mermaid diagrams render correctly (architecture, ER, deployment)
- [ ] Security doc covers threat model with specific mitigations
- [ ] Contributing guide is actionable for new developers
- [ ] README provides clear quickstart for all 3 deployment modes
