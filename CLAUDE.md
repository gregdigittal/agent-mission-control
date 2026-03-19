# CLAUDE.md — Mission Control Build Context
# Version 1.1 | March 2026 | Apache 2.0
#
# SAVE THIS FILE AS: CLAUDE.md
# LOCATION: Root of your Mission Control repository
# READ THIS ENTIRE FILE before taking any action in any session.
#
# ─────────────────────────────────────────────────────────────────────────────
# FIRST ACTIONS — RUN THESE BEFORE ANYTHING ELSE
# ─────────────────────────────────────────────────────────────────────────────
# 1. Confirm you are in the mission-control repo root
# 2. git checkout main && git pull origin main
# 3. git checkout -b feature/mission-control-platform
#    (if branch exists: git checkout feature/mission-control-platform)
# 4. NEVER commit directly to main
# 5. All work happens on feature/mission-control-platform
# 6. Open a PR to main only when a full phase passes all exit criteria
# ─────────────────────────────────────────────────────────────────────────────

## WHAT IS MISSION CONTROL

Mission Control is a multi-layer LLM orchestration platform that:
- Abstracts AI skills into portable, model-agnostic Skill IR definitions
- Routes skill execution to the best model based on capability, quality, cost, speed
- Governs AI usage at organisational level with quality floors, audit trails, compliance
- Serves three user personas via WhatsApp, Slack, web dashboard, and CLI:
  - Persona 1 Enterprise: Teams needing governed, compliant multi-model AI operations
  - Persona 2 Prosumer: Power users unifying existing LLM setups across providers
  - Persona 3 Small Business: Owners running virtual AI departments primarily via WhatsApp

The north star principle:
The Skill IR is the inviolable contract between organisational intent and model
execution. Components above the IR (OSG, OPL, GSCI) must not encode model-specific
logic. Components below the IR (Compiler, Router, Adapters) must not know about
organisational structure or policy. The IR is the firewall between these two worlds.

Three non-negotiable safety defaults:
1. When OPL is unavailable: default to max_quality policy
2. When Tier 1 approval SLA expires: default to DENY, never auto-approve
3. When CSIE is uncertain about an update: default to pending_review, never auto-apply

## BRANCH STRATEGY

  main                               stable, production-ready code
    feature/mission-control-platform ALL development work

Rules:
- Never commit to main directly
- Commit to feature/mission-control-platform after each completed component
- Open a PR to main only when a full phase passes all exit criteria
- Use git stash before switching context, not uncommitted files
- Each commit must follow the convention at the bottom of this file

Branch setup commands (run once at session start):
  cd /path/to/mission-control
  git checkout main
  git pull origin main
  git checkout -b feature/mission-control-platform
  # or if branch exists:
  git checkout feature/mission-control-platform
  git pull origin feature/mission-control-platform


## REPOSITORY STRUCTURE

  mission-control/
  CLAUDE.md                          THIS FILE
  docs/
    skill-ir-spec.md                 Skill IR open standard specification
  packages/
    skill-ir/                        Skill IR schema, validator, types
      src/
        schema/
          skill-ir.schema.ts
          metadata.schema.ts
          capability.schema.ts
          execution-flow.schema.ts
          quality-contract.schema.ts
          tool.schema.ts
        validator.ts
        types.ts
        index.ts
      examples/
        contract-review.yaml
      package.json
      README.md
    runtime/                         Compiler, Router, Adapters, Executor
      src/
        compiler/
          index.ts
          structural.ts
          capability.ts
          types.ts
        router/
          index.ts
          capability-matcher.ts
          scorer.ts
          types.ts
        adapters/
          index.ts
          base.adapter.ts
          anthropic.adapter.ts
          openai.adapter.ts
          claude-code.adapter.ts     NEW - subscription mode
          ollama.adapter.ts          NEW - free local mode
          types.ts
        context/
          index.ts
          packer.ts
          types.ts
        validator/
          index.ts
          schema-validator.ts
          constraint-validator.ts
          types.ts
        executor.ts
        index.ts
      package.json
    db/                              Prisma schema + migrations
      prisma/
        schema.prisma
        migrations/
        seed.ts
      src/index.ts
      package.json
    state-memory/                    State and Memory Layer
    opl/                             Optimisation Policy Layer
    acs/                             Advisory Caution System
    gsci/                            Guided Setup Chat Interface
    mpce/                            Multi-LLM Preservation and Conflict Engine
    channels/                        Channel Layer (open-source module)
      src/
        adapters/
          whatsapp.adapter.ts
          slack.adapter.ts
          telegram.adapter.ts
          webchat.adapter.ts
        normaliser/
          message-router.ts
          document-processor.ts
        output-adapter/
          formatter.ts
        security/
          pairing.ts
          allowlist.ts
          action-security.ts
        persona.ts
      package.json
    osg/                             Organisational Skill Graph engine
      src/
        flow-engine.ts
        best-practice-engine.ts
        template-library.ts
        types.ts
      package.json
    scheduler/                       Cron + webhook trigger scheduler
      src/
        scheduler.ts
        webhook-handler.ts
      package.json
  apps/
    api/                             Fastify REST API
    channel-gateway/                 Standalone channel gateway service
    web/                             React dashboard (Phase 3+)
  pnpm-workspace.yaml
  turbo.json
  package.json


## TECH STACK

  Language:        TypeScript 5.x throughout all packages
  Runtime:         Node.js 22+ required
  Package manager: pnpm with workspaces
  Build system:    Turborepo
  Database:        PostgreSQL 16 + pgvector
  ORM:             Prisma
  Validation:      Zod for all schemas
  Testing:         Vitest
  API server:      Fastify with TypeScript
  Queue:           BullMQ Redis-backed async jobs
  Frontend:        React 19 + Vite + Tailwind + shadcn/ui (Phase 3+)
  Canvas:          React Flow for OSG visual canvas
  FE State:        Zustand
  Data fetching:   TanStack Query v5

## ARCHITECTURAL LAYERS

  Layer 5:   External Channels
             WhatsApp, Slack, Telegram, Teams, WebChat

  Layer 4.5: Channel Layer (packages/channels - open source)
             Normalise, Security Gate, Route, Format, Deliver

  Layer 4:   UX and Intelligence
             GSCI, SPDL, MPCE, CSIE

  Layer 3:   Org Intelligence
             OSG, OPL+ACS

  ===================================================================
  Layer 2:   SKILL IR - THE CONTRACT
             Nothing above knows about models.
             Nothing below knows about org structure or policy.
  ===================================================================

  Layer 1:   Core Runtime
             Compiler, Router, Adapters, Executor
             Context Manager, Quality Validator, State and Memory

  Layer 0:   External Integrations
             LLM Providers, GitHub, HRMS, Channel APIs

## PROVIDER MODES AND SUBSCRIPTION USAGE

The Model Adapter Layer supports four provider modes. This is how Mission
Control avoids mandatory API billing and supports existing user subscriptions.

Mode 1 - API Key (default)
  Calls provider REST APIs using API keys.
  Cost: API rates (most expensive per token).
  Best for: Production, Tier 1 skills, quality-critical work.

Mode 2 - Claude Code SDK (subscription-based)
  Routes execution through @anthropic-ai/claude-code SDK not REST API.
  Cost: Consumes Claude Max/Pro subscription quota, no separate API billing.
  Best for: Users with active Claude subscriptions who want zero API cost.
  How it works:
    Mission Control compiles Skill IR
    Writes workspace files (SKILL.md, TOOLS.md, CLAUDE.md)
    Calls query() from the SDK
    Captures output from result file

  Implementation: packages/runtime/adapters/claude-code.adapter.ts

  Add to ModelCapabilityRecord:
    providerMode: "claude_code"
    requiresApiKey: false
    localEndpoint: null

  Workspace isolation per invocation:
    /tmp/mc-executions/{invocation-id}/
      CLAUDE.md          compiled quality constraints from quality_contract
      SKILL.md           compiled skill instructions from IR prompt_templates
      TOOLS.md           permitted tools for this skill from tools[] array
      input/data.json    skill inputs
      output/result.json captured output (read by Mission Control post-exec)

Mode 3 - Local Ollama (free)
  Routes to Ollama running on user machine or VPS.
  Cost: $0 per invocation (compute only, no API billing).
  Best for: High-volume Tier 3/4 tasks, cost-sensitive Persona 3 users.
  Supported: llama3.3, mistral-large, qwen2.5, gemma2, phi4
  Setup: User installs Ollama, MC auto-detects at localhost:11434.
  Limitation: Lower quality on complex reasoning than frontier models.
  NEVER use for Tier 1 skills - quality floors will not be met.
  Add to Phase 2 (not Phase 4 as originally planned).
  File: packages/runtime/adapters/ollama.adapter.ts

Mode 4 - Federated (MPCE)
  Routes to an existing configured LLM session imported via MPCE.
  Cost: Depends on underlying platform setup.
  Best for: Power users (Persona 2) with perfected existing configurations.

Equivalent mechanisms for other providers:

  Provider       Subscription path    Implementation
  Claude         Claude Code SDK      claude-code.adapter.ts - writes workspace files
  OpenAI         None available       API key only (no subscription to API bridge)
  Gemini         None available       API key only
  Local models   Ollama (free)        ollama.adapter.ts - localhost:11434
  Any provider   Federated mode       MPCE routes to existing configured session

NOTE: OpenAI ChatGPT Plus and Google Gemini Advanced subscriptions cannot be
used programmatically. The cost-free alternative is local models via Ollama.

Policy integration - add to PolicyDefinition:
  costMode: "api" | "local_preferred" | "local_only"

  local_preferred: Use local models where quality floor is met,
                   fall back to API if local cannot satisfy requirements
  local_only:      Never call paid APIs, return error if local
                   cannot satisfy capability requirements or quality floor


## SKILL IR OPEN STANDARD - FULL SPECIFICATION

First public artifact: publish to docs/skill-ir-spec.md on Phase 1 launch day
under Apache 2.0. This establishes Mission Control as the origin of the standard.

Document structure (YAML):

  skill_ir_version: "1.0"
  metadata:
    id: uuid-v4
    name: string (max 100 chars)
    version: semver MAJOR.MINOR.PATCH
    description: string (max 500 chars)
    author: string
    licence: string (SPDX e.g. Apache-2.0)
    tags: string[]
    risk_tier: 1 | 2 | 3 | 4
    created_at: ISO8601
    source_url: string (optional)
    changelog: string (optional)

  capability_requirements: (all optional, all default false/undefined)
    min_context_window_tokens: integer
    requires_tool_use: boolean
    requires_vision: boolean
    requires_code_execution: boolean
    requires_structured_output: boolean
    requires_extended_reasoning: boolean
    requires_web_search: boolean
    min_reasoning_depth: "low" | "medium" | "high"
    languages: string[] (ISO 639-1)
    additional_capabilities: object (extension point)

  input_schema: JSONSchema-Draft-7
  output_schema: JSONSchema-Draft-7

  quality_contract:
    min_quality_score: float 0.0-1.0
    requires_source_citation: boolean
    max_output_tokens: integer
    numerical_consistency_required: boolean
    determinism_preferred: boolean
    semantic_criteria: string[]
    constraints:
      - field: string (dot notation)
        rule: "non_empty_string"|"range"|"array_min_length"|"array_max_length"
        min: number (optional)
        max: number (optional)
    additional_criteria: object (extension point)

  execution_flow:
    entry_point: string (must match an existing step ID)
    steps:
      - id: string
        type: "llm_call"|"tool_call"|"decision"|"parallel"|"loop"|"output"
        intent: string (plain-language what this step does)

        llm_call fields:
          prompt_template: string (uses {{variable}} placeholders)
          input_mapping: object
          output_capture: string
          capability_hints:
            reasoning_depth: "low"|"medium"|"high"
            extended_reasoning: "preferred"|"required"|"not_needed"
            structured_output: boolean

        tool_call fields:
          tool_id: string (must match a tool in the tools array)
          tool_input_mapping: object

        decision fields:
          condition: Condition object
          true_next: string (step ID)
          false_next: string (step ID)

        parallel fields:
          branches: string[] (step IDs to run concurrently)
          join_policy: "all"|"any"|"quorum"|"timeout"
          quorum_count: integer
          timeout_seconds: integer

        loop fields:
          condition: Condition object
          body: string (step ID)
          max_iterations: integer (always required)

        output fields:
          output_mapping: object

        common optional:
          on_error: "fail"|"skip"|"retry"
          retry_count: integer
          next: string

  tools: (optional array)
    - id, name, description, input_schema, output_schema
      is_side_effectful: boolean
      requires_confirmation: boolean

  context_requirements: (optional)
    requires_conversation_history, min_history_turns
    requires_user_profile, requires_org_context
    requires_document_store, document_store_query
    max_context_tokens

Condition object:
  type: "field_comparison"|"expression"|"llm_judge"
  field_comparison: field, operator, value
  expression: expression string
  llm_judge: prompt (yes/no question), context_fields[]

Risk Tier Classification:
  Tier 1 Critical:  legal, financial compliance, medical | floor >=0.90 enforced | governance approval
  Tier 2 High:      production code, investor comms, audit | floor >=0.85 | manager acknowledgement
  Tier 3 Moderate:  customer-facing, analysis, strategic | floor >=0.75 | user acknowledgement
  Tier 4 Low:       internal drafts, brainstorming | none | no restriction

Versioning rules:
  PATCH: bug fixes, no schema changes
  MINOR: new optional fields, runtimes MUST ignore unknown fields gracefully
  MAJOR: breaking changes, runtimes MUST refuse and error clearly
  spec 1.x: fully forwards-compatible within major version

Runtime compliance - all compliant runtimes MUST:
  1. Parse and validate Skill IR YAML against spec
  2. Reject invalid documents with descriptive errors
  3. Enforce risk_tier:1 quality floors - return FloorViolationError if no model meets floor
  4. Validate all outputs against output_schema before returning
  5. Apply quality_contract.constraints to all outputs
  6. Support all execution_flow step types
  7. Handle on_error directives on all steps
  8. Translate tool definitions to model-native schemas for all supported providers
  9. Respect capability_requirements, never route to a model that fails requirements
  10. Return structured errors (never crashes) on all failure paths


## DATABASE SCHEMA - COMPLETE PRISMA

File: packages/db/prisma/schema.prisma

  generator client {
    provider = "prisma-client-js"
  }
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }

  model SkillIRDefinition {
    id                     String   @id @default(uuid())
    name                   String
    version                String
    source                 String
    sourceUrl              String?
    riskTier               Int
    intentNodes            Json
    capabilityRequirements Json
    flowGraph              Json
    inputSchema            Json
    outputSchema           Json
    qualityContract        Json
    toolDefinitions        Json[]   @default([])
    isPlatformSkill        Boolean  @default(false)
    createdAt              DateTime @default(now())
    updatedAt              DateTime @updatedAt
    configurations         SkillConfigurationInstance[]
  }

  model SkillConfigurationInstance {
    id                       String   @id @default(uuid())
    orgId                    String
    skillIrId                String
    roleId                   String?
    teamId                   String?
    customPromptOverrides    Json?
    customOutputSchema       Json?
    qualityThresholdOverride Float?
    invocationContextTag     String   @default("default")
    activeSnapshotId         String?
    isFederated              Boolean  @default(false)
    federatedPlatform        String?
    federatedConfigRef       String?
    createdAt                DateTime @default(now())
    updatedAt                DateTime @updatedAt
    skillIr                  SkillIRDefinition @relation(fields: [skillIrId], references: [id])
    snapshots                ConfigurationSnapshot[]
    observations             QualityObservation[]
  }

  model ConfigurationSnapshot {
    id                 String   @id @default(uuid())
    configInstanceId   String
    snapshotData       Json
    snapshotHash       String
    previousSnapshotId String?
    createdBy          String
    createdAt          DateTime @default(now())
    changeReason       String
    changeType         String
    isCurrent          Boolean  @default(true)
    configInstance     SkillConfigurationInstance @relation(fields: [configInstanceId], references: [id])
  }

  model OrgNode {
    id                     String   @id @default(uuid())
    orgId                  String
    parentId               String?
    nodeType               String
    name                   String
    functionTags           String[]
    isExternal             Boolean  @default(false)
    policyId               String?
    governanceAuthorityMap Json?
    autoDiscoveredFrom     String?
    createdAt              DateTime @default(now())
    updatedAt              DateTime @updatedAt
    isDeleted              Boolean  @default(false)
    persona                Json?
    parent                 OrgNode?  @relation("OrgHierarchy", fields: [parentId], references: [id])
    children               OrgNode[] @relation("OrgHierarchy")
    flowDefinitions        FlowDefinition[]
  }

  model ModelCapabilityRecord {
    id                        String   @id @default(uuid())
    modelId                   String
    taskType                  String
    providerMode              String   @default("api_key")
    platformQualityScore      Float?
    benchmarkQualityScore     Float?
    numericalConsistencyScore Float?
    costPer1kInputTokens      Decimal?
    costPer1kOutputTokens     Decimal?
    latencyP50Ms              Int?
    latencyP95Ms              Int?
    contextWindowTokens       Int?
    supportsToolUse           Boolean  @default(false)
    supportsExtendedReasoning Boolean  @default(false)
    supportsVision            Boolean  @default(false)
    supportsCodeExecution     Boolean  @default(false)
    requiresApiKey            Boolean  @default(true)
    localEndpoint             String?
    dataResidencyRegions      String[]
    isDeprecated              Boolean  @default(false)
    lastBenchmarkedAt         DateTime?
    regressionDetected        Boolean  @default(false)
    updatedAt                 DateTime @updatedAt
    @@unique([modelId, taskType])
  }


  model QualityObservation {
    id                        String   @id @default(uuid())
    configInstanceId          String
    modelId                   String
    taskType                  String
    schemaValid               Boolean
    constraintValid           Boolean
    semanticScore             Float?
    numericalConsistencyScore Float?
    latencyMs                 Int
    costUsd                   Decimal
    tokenCount                Int
    invocationContextTag      String
    observedAt                DateTime @default(now())
    configInstance            SkillConfigurationInstance @relation(fields: [configInstanceId], references: [id])
    @@index([configInstanceId, observedAt])
    @@index([modelId, taskType, observedAt])
  }

  model UserSkillModelPerformance {
    id              String   @id @default(uuid())
    userId          String
    skillId         String
    modelId         String
    orgId           String
    invocationCount Int      @default(0)
    avgQualityScore Float?
    avgLatencyMs    Float?
    avgCostUsd      Decimal?
    failureRate     Float?
    lastInvokedAt   DateTime?
    qualityTrend    String?
    updatedAt       DateTime @updatedAt
    @@unique([userId, skillId, modelId, orgId])
  }

  model PolicyDefinition {
    id                    String   @id @default(uuid())
    scopeNodeId           String
    scopeLevel            String
    preset                String
    qualityWeight         Float    @default(0.5)
    costWeight            Float    @default(0.3)
    speedWeight           Float    @default(0.2)
    costMode              String   @default("api")
    hardCostCeilingUsd    Decimal?
    hardLatencyCeilingMs  Int?
    qualityFloorOverrides Json?
    dataResidencyRegions  String[]
    modelWhitelist        String[]
    consistencyLock       Boolean  @default(false)
    determinismPreference Boolean  @default(false)
    monthlyBudgetUsd      Decimal?
    budgetSpentMtd        Decimal  @default(0)
    createdBy             String
    approvedBy            String?
    createdAt             DateTime @default(now())
    updatedAt             DateTime @updatedAt
  }

  model ACSWarningRecord {
    id                  String   @id @default(uuid())
    orgId               String
    triggeredBy         String
    riskTier            Int
    affectedSkills      String[]
    warningText         String
    quantifiedRisk      Json
    shownTo             String
    shownAt             DateTime @default(now())
    actionTaken         String?
    justification       String?
    approvalRequestId   String?
    outcomeTracked      Boolean  @default(false)
    actualQualityDelta  Float?
    warningWasAccurate  Boolean?
  }

  model ApprovalRequest {
    id               String   @id @default(uuid())
    orgId            String
    requesterId      String
    skillId          String
    currentPolicyId  String
    requestedChange  Json
    riskSummary      String
    justification    String
    urgency          String
    status           String
    governanceUserId String
    requestedAt      DateTime @default(now())
    respondedAt      DateTime?
    slaExpiresAt     DateTime
    responseNote     String?
  }

  model AuditEntry {
    id                String   @id @default(uuid())
    orgId             String
    entryHash         String
    previousEntryHash String?
    actorId           String
    actionType        String
    entityType        String
    entityId          String
    beforeState       Json?
    afterState        Json?
    acsWarningId      String?
    justification     String?
    occurredAt        DateTime @default(now())
    ipAddress         String?
    @@index([orgId, occurredAt])
  }

  model FlowDefinition {
    id               String   @id @default(uuid())
    orgNodeId        String
    name             String
    version          String   @default("1.0.0")
    nodes            Json[]
    edges            Json[]
    syncPolicies     Json?
    loopDefinitions  Json?
    frameworkTag     String?
    healthScore      Float?
    activeViolations Json[]   @default([])
    createdAt        DateTime @default(now())
    updatedAt        DateTime @updatedAt
    orgNode          OrgNode  @relation(fields: [orgNodeId], references: [id])
    triggers         FlowTrigger[]
    executions       FlowExecution[]
  }


  model FlowTrigger {
    id               String   @id @default(uuid())
    flowDefinitionId String
    type             String
    cronSchedule     String?
    cronTimezone     String?
    webhookEndpoint  String?
    webhookSecret    String?
    payloadMapping   Json?
    eventType        String?
    eventCondition   Json?
    isActive         Boolean  @default(true)
    lastRunAt        DateTime?
    nextRunAt        DateTime?
    createdAt        DateTime @default(now())
    flowDefinition   FlowDefinition @relation(fields: [flowDefinitionId], references: [id])
  }

  model FlowExecution {
    id                String   @id @default(uuid())
    flowDefinitionId  String
    triggeredBy       String
    triggeredByUserId String?
    status            String
    startedAt         DateTime @default(now())
    completedAt       DateTime?
    stepStates        Json[]
    outputs           Json?
    errorMessage      String?
    flowDefinition    FlowDefinition @relation(fields: [flowDefinitionId], references: [id])
  }

  model UserSession {
    id           String   @id @default(uuid())
    userId       String
    orgId        String
    sessionType  String
    context      Json
    createdAt    DateTime @default(now())
    lastActiveAt DateTime @updatedAt
    isActive     Boolean  @default(true)
  }

  model DiscoveryRecord {
    id                    String   @id @default(uuid())
    source                String
    sourceUrl             String
    rawMetadata           Json
    normalisedIrDraft     Json?
    preScreenPassed       Boolean  @default(false)
    preScreenNotes        String?
    relevanceScores       Json?
    qualityBenchmarkScore Float?
    conflictsWith         String[]
    conflictType          String?
    status                String
    discoveredAt          DateTime @default(now())
  }

  model ConflictRecord {
    id                     String   @id @default(uuid())
    orgId                  String
    conflictType           String
    skillARef              Json
    skillBRef              Json
    conflictClassification String
    qualityComparison      Json?
    resolutionOptions      Json[]
    chosenResolution       Json?
    resolvedBy             String?
    resolvedAt             DateTime?
    status                 String
    createdAt              DateTime @default(now())
  }

  model SenderIdentity {
    id               String   @id @default(uuid())
    userId           String
    orgId            String
    channelType      String
    channelSenderId  String
    isVerified       Boolean  @default(false)
    isPaired         Boolean  @default(false)
    pairingCode      String?
    pairingExpiresAt DateTime?
    pairingAttempts  Int      @default(0)
    allowedActions   String[]
    createdAt        DateTime @default(now())
    lastActiveAt     DateTime @updatedAt
    @@unique([channelType, channelSenderId])
  }


## SEED DATA - packages/db/prisma/seed.ts

  const seedModels = [
    {
      modelId: 'anthropic:claude-opus-4-6:latest',
      taskType: 'general', providerMode: 'api_key',
      benchmarkQualityScore: 0.96,
      costPer1kInputTokens: 0.015, costPer1kOutputTokens: 0.075,
      latencyP50Ms: 8000, contextWindowTokens: 200000,
      supportsToolUse: true, supportsExtendedReasoning: true,
      supportsVision: true, requiresApiKey: true,
    },
    {
      modelId: 'anthropic:claude-code:subscription',
      taskType: 'general', providerMode: 'claude_code',
      benchmarkQualityScore: 0.96,
      costPer1kInputTokens: 0, costPer1kOutputTokens: 0,
      latencyP50Ms: 8000, contextWindowTokens: 200000,
      supportsToolUse: true, supportsExtendedReasoning: true,
      supportsVision: true, supportsCodeExecution: true,
      requiresApiKey: false,
    },
    {
      modelId: 'anthropic:claude-sonnet-4-6:latest',
      taskType: 'general', providerMode: 'api_key',
      benchmarkQualityScore: 0.91,
      costPer1kInputTokens: 0.003, costPer1kOutputTokens: 0.015,
      latencyP50Ms: 3500, contextWindowTokens: 200000,
      supportsToolUse: true, requiresApiKey: true,
    },
    {
      modelId: 'anthropic:claude-haiku-4-5-20251001:latest',
      taskType: 'general', providerMode: 'api_key',
      benchmarkQualityScore: 0.78,
      costPer1kInputTokens: 0.0008, costPer1kOutputTokens: 0.004,
      latencyP50Ms: 1200, contextWindowTokens: 200000,
      supportsToolUse: true, requiresApiKey: true,
    },
    {
      modelId: 'openai:gpt-4o:latest',
      taskType: 'general', providerMode: 'api_key',
      benchmarkQualityScore: 0.92,
      costPer1kInputTokens: 0.005, costPer1kOutputTokens: 0.015,
      latencyP50Ms: 4000, contextWindowTokens: 128000,
      supportsToolUse: true, requiresApiKey: true,
    },
    {
      modelId: 'openai:gpt-4o-mini:latest',
      taskType: 'general', providerMode: 'api_key',
      benchmarkQualityScore: 0.82,
      costPer1kInputTokens: 0.00015, costPer1kOutputTokens: 0.0006,
      latencyP50Ms: 1500, contextWindowTokens: 128000,
      supportsToolUse: true, requiresApiKey: true,
    },
    {
      modelId: 'ollama:llama3.3:local',
      taskType: 'general', providerMode: 'local',
      benchmarkQualityScore: 0.72,
      costPer1kInputTokens: 0, costPer1kOutputTokens: 0,
      latencyP50Ms: 2000, contextWindowTokens: 128000,
      supportsToolUse: false, requiresApiKey: false,
      localEndpoint: 'http://localhost:11434',
    },
  ]

## PHASED BUILD PLAN

Phase 1 - Foundation
Branch: feature/mission-control-platform
Goal: One skill, two models, one user. Prove the IR contract works end to end.
Public artifact: Skill IR spec published to docs/skill-ir-spec.md Apache 2.0

  Component                            Package                  Complexity
  Skill IR schema (Zod)                packages/skill-ir        M
  Skill IR validator                   packages/skill-ir        M
  contract-review.yaml example         packages/skill-ir        S
  PostgreSQL schema Phase 1 entities   packages/db              M
  Seed data 7 model records            packages/db              S
  Anthropic adapter                    packages/runtime         M
  OpenAI adapter                       packages/runtime         M
  Claude Code SDK adapter              packages/runtime         L  NEW
  Ollama adapter                       packages/runtime         M  NEW
  Skill IR Compiler tiers 1+2          packages/runtime         L
  Capability Router v1                 packages/runtime         M
  Context Manager v1                   packages/runtime         S
  Quality Validator v1                 packages/runtime         S
  State and Memory v1                  packages/runtime         S
  Fastify API                          apps/api                 M

Phase 1 exit criteria:
  pnpm test passes >80% coverage on core packages
  contract-review.yaml validates without errors
  POST /api/v1/skills stores a skill definition
  POST /api/v1/invocations executes across Claude API and Claude Code SDK
  POST /api/v1/invocations executes via Ollama when costMode=local_only
  risk_tier:1 floor enforcement returns FloorViolationError in router tests
  All AuditEntry records created with valid cryptographic chain
  docs/skill-ir-spec.md published with Apache 2.0 header
  Commit: feat: complete Phase 1 foundation
  PR opened to merge into main

Phase 2 - Single-User Value
Goal: Prosumer and small business owner find MC better than manual setup.
WhatsApp is non-negotiable in this phase - primary interface for Persona 3.

  Component                            Package                  Complexity
  Additional DB models Phase 2         packages/db              M
  State and Memory full                packages/state-memory    M
  OPL basic 3 presets                  packages/opl             M
  ACS Tier 1+2 floors                  packages/acs             L
  Config snapshot system               packages/db              M
  GSCI onboarding mode                 packages/gsci            XL
  MPCE import Claude + OpenAI          packages/mpce            XL
  Channel Layer core types             packages/channels        M
  WhatsApp adapter                     packages/channels        L
  Slack adapter                        packages/channels        M
  WebChat adapter                      packages/channels        S
  Output adaptation engine             packages/channels        M
  Document processor                   packages/channels        M
  Virtual employee personas            packages/channels        S
  Channel Gateway service              apps/channel-gateway     L
  New API routes Phase 2               apps/api                 L

Phase 2 exit criteria:
  GSCI onboards a user via WhatsApp in under 15 minutes
  Claude Project and Custom GPT import with <10% quality degradation
  ACS blocks Tier 1 floor violations and creates approval requests
  Photographed contract via WhatsApp routes to contract-review skill
  Virtual employee personas rewrite outputs in correct voice
  BullMQ processes messages async, webhook acks in <200ms
  All config mutations create immutable snapshots with SHA-256 hashing
  Commit: feat: complete Phase 2 single-user value
  PR opened to merge into main


Phase 3 - Team Value
Goal: Team lead configures org flows, policies enforced, automation runs.

  Component                            Package                  Complexity
  Additional DB models Phase 3         packages/db              M
  OSG flow engine                      packages/osg             XL
  OSG best-practice rule library       packages/osg             L
  OSG flow templates                   packages/osg             L
  OPL v2 hierarchical + simulation     packages/opl             L
  ACS v2 live preview + drift          packages/acs             L
  Budget manager                       packages/opl             M
  Cron + webhook scheduler             packages/scheduler       M
  Telegram adapter                     packages/channels        M
  Teams adapter                        packages/channels        M
  Voice input Whisper STT              packages/channels        L
  GSCI v2 team mode                    packages/gsci            L
  Governance authority assignment      apps/api                 M
  Tamper-evident audit trail           apps/api                 M
  Web dashboard Phase 3                apps/web                 XL
  Phase 3 API routes                   apps/api                 L

OSG best-practice rules:
  BP-001 critical  flow has no trigger node
  BP-002 critical  flow has no output artefact node
  BP-003 critical  circular dependency without loop node
  BP-010 warning   role has orphaned skills not in any flow
  BP-011 warning   cross-team handoff with no acceptance criteria
  BP-020 advisory  scrum team missing retrospective skill
  BP-021 advisory  retrospective output not connected to sprint planning
  BP-030 advisory  marketing flow with no analytics skill at end
  BP-040 warning   finance flow missing reconciliation step
  BP-041 warning   numerical skill not on maximum quality policy
  BP-050 advisory  role assigned more than 12 skills

Budget tightening priority - NEVER violate this order:
  1. Tier 1 skills: NEVER tightened regardless of budget state
  2. Tier 4 skills: tighten at 70% budget consumed
  3. Tier 3 skills: tighten at 80% budget consumed
  4. Tier 2 skills: tighten only if deficit > 20%

ACS approval SLA:
  routine:  24 hours
  urgent:   4 hours
  critical: 1 hour
  SLA EXPIRY DEFAULT: DENY - never auto-approve on timeout

Phase 3 exit criteria:
  Scrum team from template shows correct ceremony flow structure
  Policy simulation correctly projects quality and cost before applying
  Tier 1 floor violations blocked at simulation with suggested resolution
  Cron trigger runs weekly flow and delivers to WhatsApp channel
  Budget tightening never reduces Tier 1 quality floors (tested)
  Drift monitor detects model regression and alerts policy owner
  Web dashboard shows virtual employee daily summaries on login
  Commit: feat: complete Phase 3 team value
  PR opened to merge into main

Phase 4 - Organisational Intelligence
Goal: Visual canvas live, sub-task routing, federated orchestration working.

  OSG v2 React Flow visual canvas          apps/web          XL
  OSG live execution overlay               apps/web          L
  OPL v3 optimisation opportunity feed     packages/opl      L
  ACS v3 outcome tracking + earned trust   packages/acs      L
  MPCE v2 federated + hybrid mode          packages/mpce     XL
  Cross-model Context Manager              packages/runtime  L
  Capability Router v2 sub-task granular   packages/runtime  XL
  CSIE v1 GitHub + provider scanning       packages/csie     L
  Quality Validator v2 semantic            packages/runtime  M
  Model Adapter v2 agentic + Ollama v2     packages/runtime  L
  Browser control read-only sandboxed      packages/runtime  L
  Voice output ElevenLabs TTS              packages/channels M
  Agent-to-agent messaging                 packages/runtime  M

Phase 4 exit criteria:
  Visual canvas renders 200-node org graph without perf degradation
  Sub-task granular routing tested across 5-step skills
  Federated mode routes to all three major providers with context preserved
  CSIE automated safe update pipeline - 0% false positive rate
  Commit: feat: complete Phase 4 organisational intelligence
  PR opened to merge into main

Phase 5 - Platform and Ecosystem
Goal: Mission Control becomes infrastructure others build on.

  SPDL v2 full marketplace                 packages/spdl     XL
  CSIE v2 academic + auto-safe updates     packages/csie     L
  Third-party API OAuth webhooks           apps/api          XL
  ClawHub compatibility layer              packages/spdl     L
  Cross-org anonymised benchmarking        packages/csie     L
  Compliance export suite                  apps/api          L
  Skill IR governance process              docs/             S

Phase 5 exit criteria:
  Marketplace has 100 community skills passing quality gate
  Third-party API achieves 99.9% uptime over 30-day SLA
  Cross-org benchmarking passes third-party privacy audit
  EU AI Act compliance report reviewed by external legal counsel
  Commit: feat: complete Phase 5 platform and ecosystem
  PR opened to merge into main


## API ROUTES REFERENCE

Phase 1:
  POST   /api/v1/skills/validate         ValidationResult
  POST   /api/v1/skills                  id name version riskTier
  GET    /api/v1/skills/:id              SkillIRDefinition
  POST   /api/v1/invocations             ExecutionResult
  GET    /api/v1/invocations/:id         ExecutionResult + trace
  GET    /api/v1/models                  ModelCapabilityRecord[]

Phase 2:
  POST   /api/v1/gsci/message            response conversation pendingConfigPreview
  GET    /api/v1/gsci/session/:id        GSCIConversation
  POST   /api/v1/gsci/confirm            void applies confirmed config
  GET    /api/v1/configs/:id/snapshots   ConfigurationSnapshot[]
  POST   /api/v1/configs/:id/rollback    void
  POST   /api/v1/configs/import/claude   Partial SkillIRDocument + conflicts[]
  POST   /api/v1/configs/import/openai   Partial SkillIRDocument + conflicts[]
  POST   /api/v1/policies                PolicyDefinition
  GET    /api/v1/policies/:nodeId/effective  PolicyDefinition
  POST   /api/v1/policies/preview        ACSWarning[]
  GET    /api/v1/acs/warnings/:orgId     ACSWarningRecord[]
  POST   /api/v1/acs/warnings/:id/acknowledge  void
  POST   /api/v1/acs/approvals           ApprovalRequest
  PUT    /api/v1/acs/approvals/:id       void

Phase 3:
  POST   /api/v1/flows                   FlowDefinition
  GET    /api/v1/flows/:id               FlowDefinition + violations + healthScore
  PUT    /api/v1/flows/:id               FlowDefinition
  POST   /api/v1/flows/:id/execute       FlowExecution
  GET    /api/v1/flows/:id/executions    FlowExecution[]
  POST   /api/v1/flows/templates/:id     FlowDefinition
  GET    /api/v1/flows/:id/violations    FlowViolation[]
  POST   /api/v1/triggers                FlowTrigger
  PUT    /api/v1/triggers/:id            FlowTrigger
  DELETE /api/v1/triggers/:id            void
  POST   /webhooks/flow/:triggerId       void
  POST   /api/v1/policies/simulate       PolicySimulationResult
  GET    /api/v1/policies/:orgId/drift   PolicyDriftAlert[]
  GET    /api/v1/policies/:orgId/budget  BudgetState
  GET    /api/v1/policies/:orgId/opportunities  OptimisationOpportunity[]

## CORE IMPLEMENTATION RULES

Skill IR Validator - cross-reference checks required:
  1. All step next references point to existing step IDs
  2. entry_point points to an existing step ID
  3. parallel branches all reference existing step IDs
  4. decision true_next and false_next reference existing step IDs
  5. tool_call tool_id values reference tools defined in the tools array
  6. WARN not error: risk_tier:1 with no semantic_criteria in quality_contract
  7. WARN not error: min_quality_score < 0.85 for risk_tier 1 or 2

Capability Router - three-phase algorithm:
  Phase 1: Hard constraint filtering
    capability_requirements satisfied
    data_residency_regions compliant if specified in policy
    model_whitelist satisfied if specified in policy
    cost_ceiling not exceeded if specified in policy
    providerMode matches policy costMode
      costMode=local_only: only providerMode=local or claude_code pass
      costMode=local_preferred: local modes first, api_key as fallback
    If Phase 1 empty: return ConstraintViolationError with options

  Phase 2: Quality floor enforcement
    Filter to models meeting skill min_quality_score for task_type
    If empty AND risk_tier=1: return FloorViolationError NEVER bypass
    If empty AND risk_tier 2-4: log warning, use best available

  Phase 3: Multi-objective scoring
    weighted_score = policy.qualityWeight  * quality_score
                   + policy.costWeight     * (1 - normalised_cost)
                   + policy.speedWeight    * (1 - normalised_latency)
    Return highest-scored model

  Policy presets:
    max_quality:     quality 0.8, cost 0.1, speed 0.1
    balanced:        quality 0.5, cost 0.3, speed 0.2
    cost_optimised:  quality 0.3, cost 0.6, speed 0.1
    speed_optimised: quality 0.3, cost 0.2, speed 0.5

  SAFETY DEFAULT: When policy unavailable, default to max_quality weights.
  Tier 1 floor violations NEVER bypass regardless of costMode.

Compiler - per-model prompt structure:
  Claude family:
    System: <system>...</system>
    Structure: <context> <task> <output_format> XML tags
    Extended thinking: thinking type enabled, budget_tokens N
    Tools: tool_use input_schema format

  Claude Code SDK (claude-code.adapter.ts):
    Write SKILL.md with compiled prompt from IR prompt_templates
    Write TOOLS.md with tool definitions translated to markdown format
    Write CLAUDE.md with quality_contract constraints as instructions
    Call query() from @anthropic-ai/claude-code SDK
    Stream messages, extract structured output from output/result.json
    Clean up workspace directory after successful capture

  GPT family:
    System: plain instruction paragraph
    Structure: ## Context ## Task ## Output Format markdown headers
    Structured output: response_format json_object
    Tools: functions tools array with parameters JSON Schema

  Ollama (ollama.adapter.ts):
    Endpoint: http://localhost:11434/api/chat
    System: injected as system message
    Tool use: only for models that support it, check capabilities
    Streaming: uses Ollama streaming format
    Auto-detect: on startup, ping localhost:11434/api/tags

  Context window allocation:
    system_prompt:        20% of token budget
    conversation_history: 40% of token budget
    current_task:         30% of token budget
    output_buffer:        10% of token budget

GSCI critical rules:
  NEVER write config without user confirmation.
  Every mutation shows what will change and waits for explicit confirmation.
  requiresConfirmation must be true until user explicitly confirms.

  ACS warnings are conversational not modal:
    BAD:  popup WARNING: Quality floor violation
    GOOD: I can do that, but your Legal team has 3 Tier 1 skills with
          quality floors - applying Cost-Optimised would need General
          Counsel approval. Apply Cost-Optimised everywhere except Legal?

  Conversation stages:
    1. org_structure:  parse description, draft OrgNode tree, confirm
    2. team_skills:    per team suggest skills, accept/reject
    3. policy_setup:   suggest presets, conversational ACS warnings
    4. review:         show full config, final confirmation
    5. complete:       apply, show setup summary

  Virtual employee defaults:
    marketing:  name Maya,  emoji goal, style enthusiastic concise bullet points
    legal:      name Lex,   emoji scales, style precise cautious cites specifics
    finance:    name Nova,  emoji money, style direct numbers-focused flags risks
    operations: name Ops,   emoji gear, style efficient action-oriented checklists

Channel security rules - NEVER bypass:
  Unknown sender: send pairing code, do not process message
  Tier 1 action: require exact phrase CONFIRM APPROVE not yes not ok
  Tier 2 action: require confirmation code sent to secondary channel
  Tier 3/4 actions: proceed normally
  Consequential config changes: web UI only, never via messaging channel
  ACS checks on channel actions are IDENTICAL to UI actions

WhatsApp output formatting rules:
  Plain text only (no markdown)
  Max 4096 chars per message
  If output > 500 chars: 3-sentence summary + PDF attachment
  Risk flags: red CRITICAL orange HIGH yellow MEDIUM green LOW
  Max 3 interactive buttons


## REFERENCE SKILL - contract-review.yaml

Save at packages/skill-ir/examples/contract-review.yaml

  skill_ir_version: "1.0"
  metadata:
    id: "550e8400-e29b-41d4-a716-446655440000"
    name: "Contract Review"
    version: "1.2.0"
    description: "Reviews a contract and identifies risks, obligations, non-standard clauses"
    author: "mission-control-core"
    licence: "Apache-2.0"
    tags: ["legal", "contract", "review", "risk-analysis"]
    risk_tier: 1
    created_at: "2026-03-17T00:00:00Z"

  capability_requirements:
    min_context_window_tokens: 32000
    requires_structured_output: true
    min_reasoning_depth: "high"
    requires_extended_reasoning: true
    languages: ["en"]

  input_schema:
    type: object
    required: [contract_text, jurisdiction]
    properties:
      contract_text: { type: string }
      jurisdiction: { type: string }
      contract_type: { type: string, default: "general" }
      review_focus: { type: array, items: { type: string } }
    additionalProperties: false

  output_schema:
    type: object
    required: [risk_summary, issues, overall_risk_level, recommendation]
    properties:
      risk_summary: { type: string }
      overall_risk_level:
        type: string
        enum: ["low", "medium", "high", "critical"]
      issues:
        type: array
        items:
          type: object
          required: [severity, clause_reference, description, recommendation]
          properties:
            severity: { type: string, enum: [critical, high, medium, low, informational] }
            clause_reference: { type: string }
            description: { type: string }
            recommendation: { type: string }
            suggested_redline: { type: string }
      recommendation:
        type: string
        enum: ["approve", "approve_with_amendments", "reject", "requires_legal_counsel"]

  quality_contract:
    min_quality_score: 0.92
    requires_source_citation: true
    determinism_preferred: true
    semantic_criteria:
      - "All issues reference specific clause numbers"
      - "Recommendations are actionable and jurisdiction-specific"
      - "No issues fabricated that are not present in the input text"
      - "Plain English explanations accompany all legal observations"
    constraints:
      - field: "overall_risk_level"
        rule: "non_empty_string"

  execution_flow:
    entry_point: "parse_contract"
    steps:
      - id: "parse_contract"
        type: "llm_call"
        intent: "Extract structural elements - parties, dates, obligations, payment terms, termination, governing law"
        prompt_template: |
          You are a senior legal analyst. Extract the key structural elements
          from this {{jurisdiction}} {{contract_type}} contract.
          Contract: {{contract_text}}
          Extract: parties, effective date, term, payment terms, key obligations
          per party, termination conditions, governing law, dispute resolution.
        input_mapping:
          contract_text: "input.contract_text"
          jurisdiction: "input.jurisdiction"
          contract_type: "input.contract_type"
        output_capture: "parsed_structure"
        capability_hints:
          reasoning_depth: "high"
          structured_output: true
        next: "risk_analysis"

      - id: "risk_analysis"
        type: "llm_call"
        intent: "Identify risks, one-sided clauses, missing protections, jurisdiction-specific issues"
        prompt_template: |
          You are a senior contracts lawyer specialising in {{jurisdiction}} law.
          Contract structure: {{parsed_structure}}
          Original contract: {{contract_text}}
          Focus areas: {{review_focus}}
          For each issue: severity, exact clause reference, plain-English
          description, specific recommendation, suggested redline where appropriate.
        input_mapping:
          parsed_structure: "steps.parse_contract.parsed_structure"
          contract_text: "input.contract_text"
          jurisdiction: "input.jurisdiction"
          review_focus: "input.review_focus"
        output_capture: "identified_issues"
        capability_hints:
          reasoning_depth: "high"
          extended_reasoning: "preferred"
        next: "synthesise_output"

      - id: "synthesise_output"
        type: "llm_call"
        intent: "Produce final structured review with executive summary and recommendation"
        prompt_template: |
          Based on the analysis produce a structured review report.
          Structure: {{parsed_structure}}
          Issues: {{identified_issues}}
          Produce: executive risk summary, overall risk level, final recommendation,
          structured issues list with all required fields.
        input_mapping:
          parsed_structure: "steps.parse_contract.parsed_structure"
          identified_issues: "steps.risk_analysis.identified_issues"
        output_capture: "final_review"
        capability_hints:
          structured_output: true
        next: "output"

      - id: "output"
        type: "output"
        output_mapping:
          risk_summary: "steps.synthesise_output.final_review.risk_summary"
          overall_risk_level: "steps.synthesise_output.final_review.overall_risk_level"
          recommendation: "steps.synthesise_output.final_review.recommendation"
          issues: "steps.synthesise_output.final_review.issues"


## ENVIRONMENT VARIABLES

  DATABASE_URL=postgresql://user:password@localhost:5432/mission_control
  REDIS_URL=redis://localhost:6379

  ANTHROPIC_API_KEY=
  OPENAI_API_KEY=
  GOOGLE_AI_API_KEY=
  MISTRAL_API_KEY=

  WHATSAPP_PHONE_NUMBER_ID=
  WHATSAPP_ACCESS_TOKEN=
  WHATSAPP_WEBHOOK_VERIFY_TOKEN=
  SLACK_BOT_TOKEN=
  SLACK_APP_TOKEN=
  SLACK_SIGNING_SECRET=
  TELEGRAM_BOT_TOKEN=

  MAIN_API_URL=http://localhost:3000
  CHANNEL_GATEWAY_URL=http://localhost:3001
  OLLAMA_ENDPOINT=http://localhost:11434
  NODE_ENV=development
  PORT=3000

## OPEN-SOURCE STRATEGY

Licence: Apache 2.0 for all open-source components.
Apache 2.0 chosen over MIT for the explicit patent grant.

Open-source (publish to GitHub under Apache 2.0):
  packages/skill-ir            the standard reference implementation
  packages/runtime             compiler tiers 1-2, basic router, adapters, executor
  packages/channels            published as @mission-control/channels
  packages/db                  Prisma schema
  docs/skill-ir-spec.md        the formal open standard

Proprietary (commercial tier):
  packages/osg                 visual canvas, best-practice engine
  packages/opl                 policy simulation, drift detection, budget management
  packages/acs                 full ACS with outcome tracking
  packages/csie                continuous scanning
  Compliance export suite
  Cross-org quality benchmarking
  Sub-task granular router Phase 4
  Semantic quality validator Phase 4

The Skill IR as an open standard:
  Publish docs/skill-ir-spec.md as a formal open standard on Phase 1 launch day.
  Not just open-source code but a specification document with versioning and governance.
  This establishes Mission Control as the origin of the standard.

## KEY INVARIANTS - NEVER VIOLATE

1. Configuration immutability
   Every config change creates a new ConfigurationSnapshot.
   Nothing is mutated in place. Previous state always restorable.
   SHA-256 hash chaining enables tamper detection.

2. Audit trail completeness
   Every consequential action logged immutably with cryptographic chaining.
   Cannot be modified by any user including admins. Append-only.
   Retention: 7 years.

3. Safety defaults
   OPL unavailable: max_quality policy
   Tier 1 approval SLA expires: DENY never auto-approve
   CSIE uncertain: pending_review never auto-apply
   Floor check fails for Tier 1: FloorViolationError never bypass

4. IR boundary
   Components above Layer 2 (OSG, OPL, GSCI) must NOT reference
   specific model IDs, provider APIs, or prompt formats.
   Components below Layer 2 (Compiler, Router, Adapters) must NOT
   reference org structure, team IDs, or policy definitions.

5. Tier 1 floors are non-negotiable
   Cannot be bypassed by cost policy, speed policy, or budget constraint.
   Router returns FloorViolationError before execution. No exceptions.
   This applies even when costMode is local_only.

6. GSCI never writes without confirmation
   Every config mutation shows what will change and waits for explicit
   confirmation. requiresConfirmation must be honoured in all paths.

7. Channel security parity
   ACS checks on channel-triggered actions are identical to UI actions.
   WhatsApp CONFIRM APPROVE passes through the same Tier 1 floor check.
   Channels are input surfaces, not trust escalators.

## COMMIT CONVENTIONS

  feat(skill-ir): description
  feat(runtime/compiler): description
  feat(runtime/router): description
  feat(runtime/adapters): description
  feat(runtime/adapters/claude-code): description
  feat(runtime/adapters/ollama): description
  feat(runtime/executor): description
  feat(db): description
  feat(state-memory): description
  feat(opl): description
  feat(acs): description
  feat(gsci): description
  feat(mpce): description
  feat(channels): description
  feat(channels/whatsapp): description
  feat(channels/slack): description
  feat(osg): description
  feat(scheduler): description
  feat(api): description
  feat(web): description
  test(package-name): description
  fix(package-name): description
  docs: description
  chore: description

## CURRENT BUILD STATUS

  Active branch:    feature/mission-control-platform
  Current phase:    Phase 1 - Foundation
  Status:           NOT STARTED

  Next actions (execute in this order):
  1.  git checkout main && git pull origin main
  2.  git checkout -b feature/mission-control-platform
  3.  Create pnpm-workspace.yaml and turbo.json
  4.  Create packages/skill-ir directory structure
  5.  Implement SkillIRSchema in Zod (all step types, all condition types)
  6.  Implement validator.ts with all cross-reference checks
  7.  Write packages/skill-ir/examples/contract-review.yaml
  8.  Verify validator passes on contract-review.yaml
  9.  git commit -m "feat(skill-ir): implement Skill IR schema validator reference example"
  10. Create packages/db/prisma/schema.prisma (Phase 1 models only)
  11. Create seed.ts with 7 ModelCapabilityRecord entries including claude-code and ollama
  12. git commit -m "feat(db): implement Phase 1 Prisma schema and seed data"
  13. Implement packages/runtime/adapters/anthropic.adapter.ts
  14. Implement packages/runtime/adapters/openai.adapter.ts
  15. Implement packages/runtime/adapters/claude-code.adapter.ts
      (writes workspace files, calls query() from @anthropic-ai/claude-code SDK)
  16. Implement packages/runtime/adapters/ollama.adapter.ts
      (auto-detects localhost:11434, OpenAI-compatible API)
  17. git commit -m "feat(runtime/adapters): implement all four adapters"
  18. Implement packages/runtime/compiler/ (structural + capability tiers)
  19. git commit -m "feat(runtime/compiler): implement structural and capability compilation"
  20. Implement packages/runtime/router/ (three-phase algorithm with providerMode support)
  21. git commit -m "feat(runtime/router): implement three-phase model selection"
  22. Implement packages/runtime/executor.ts
  23. Implement packages/runtime/validator/ (schema + constraint tiers)
  24. git commit -m "feat(runtime/executor): implement skill execution engine"
  25. Implement apps/api/ (Fastify, all Phase 1 routes)
  26. git commit -m "feat(api): implement Phase 1 REST API"
  27. Write Vitest tests for all Phase 1 components
  28. git commit -m "test: Phase 1 comprehensive test suite"
  29. Verify all Phase 1 exit criteria pass
  30. Publish docs/skill-ir-spec.md to GitHub (Apache 2.0)
  31. git commit -m "docs: publish Skill IR open standard specification v1.0"
  32. Open PR: feature/mission-control-platform -> main

Update this section after each phase is complete.
Change Current phase and Next actions to reflect progress.
This file is the single source of truth for all Claude Code sessions.

CLAUDE.md - Mission Control | Version 1.1 | March 2026 | Apache 2.0
Read this file at the start of every Claude Code session on hetzner-agents.
