# AI Developer Analytics — Copilot Instructions

## Project Overview

Multi-agent software architecture analysis system written in **TypeScript** (ES2022, CommonJS). Analyzes codebases via a 10-step pipeline and produces feature analysis packages (requirements, scope, solution, impact, estimation, documentation).

## Build & Run

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run dev` | Run with ts-node (development) |
| `npm start` | Run compiled CLI |
| `npm run generate <desc>` | Full pipeline for a feature |
| `npm run lint` | ESLint |
| `npm run clean` | Remove dist/ |

## Architecture

```
CLI (commander) → Orchestrator → 10 Agents (sequential pipeline) → Output Generator
```

**Pipeline stages** (in order):
1. RepositoryIndexer → 2. DatabaseReader → 3. Requirements → 4. Scope → 5. Reuse → 6. SolutionArchitect → 7. ImpactAnalysis → 8. Estimation → 9. Documentation → 10. Prototype

**Data flow**: A `FeatureContext` object accumulates outputs from each agent. `SessionContext` provides shared access to session ID, config, and artifacts.

### Execution Modes

Three modes controlled by `ModeManager`: `LLM_ONLINE`, `LLM_OFFLINE`, `REPOSITORY_ONLY`.
- Fallback is one-way: `LLM_ONLINE → LLM_OFFLINE` on API failure (no upgrade back during a run).
- `REPOSITORY_ONLY` restricts to 5 agents (Indexer, Reuse, Impact, Estimation, Documentation). New agents must be whitelisted in `mode-manager.ts` to run in this mode.

## Directory Layout

```
src/
  agents/          # Pipeline agents — one file per agent
  config/          # Config loader, language labels (pt-BR)
  core/            # IAgent interface, BaseAgent, ModeManager, Logger
  database/        # DB reader + engine adapters (postgres, mysql, mssql)
  indexer/         # Repository scanner + sub-scanners
  orchestrator/    # Pipeline coordination
  output/          # Markdown/JSON file writer
  types/           # Shared types & enums

prompts/           # LLM prompt templates (one .txt per agent)
context/           # Auto-generated repo analysis JSONs (do not edit manually)
docs/features/     # Pipeline output per feature (Markdown + JSON + logs)
```

## Conventions

### Naming

- **Agent class**: `{Feature}Agent` (e.g., `EstimationAgent`)
- **Agent file**: `src/agents/{feature}.agent.ts` (e.g., `estimation.agent.ts`)
- **Agent role enum**: `AgentRole.{Feature}` in `src/types/index.ts`
- **Scanner file**: `src/indexer/scanners/{name}-scanner.ts`
- **DB engine file**: `src/database/engines/{name}.engine.ts`

### Language & Localization

- **All user-facing text is Portuguese (pt-BR)**, sourced from the `Labels` object in `src/config/language.ts`.
- Internal variable names, JSON keys, and code comments stay in **English**.
- Never hardcode Portuguese strings directly in agent logic — always use `Labels`.

### Agent Pattern

Every agent extends `BaseAgent<TInput, TOutput>` and implements:

```typescript
protected abstract run(input: TInput, context: SessionContext): Promise<TOutput>;
```

Use `withLlmFallback(llmFn, offlineFn)` for graceful LLM degradation.

### Barrel Exports

Each module folder has an `index.ts` barrel. Export new files from there.

### Path Aliases

Configured in `tsconfig.json`: `@agents/*`, `@core/*`, `@services/*`, `@config/*`, `@output/*`, `@types/*`.

## Adding a New Agent

1. Create `src/agents/{feature}.agent.ts` extending `BaseAgent`
2. Add `AgentRole.{Feature}` to the enum in `src/types/index.ts`
3. Export from `src/agents/index.ts`
4. Add step in `src/orchestrator/orchestrator.ts` (with prerequisites)
5. Add prompt template in `prompts/{feature}-agent.txt` (if LLM-backed)
6. Add labels to `src/config/language.ts`
7. If allowed offline, whitelist in `src/core/mode-manager.ts`

## Pitfalls

- **Prerequisite cascading**: If a step fails in normal mode, all its dependents are skipped. In `REPOSITORY_ONLY`, prerequisites are ignored — agents must handle partial context.
- **Context files are auto-generated**: `context/*.json` is overwritten by the indexer. Don't manually edit.
- **Estimation math**: `baseHours × depMultiplier × reuseDiscount`. High dependency counts amplify estimates significantly.
- **RequirementsAgent inference** depends on naming conventions ("auth", "valid", etc.) in existing service/component names. Inconsistent naming produces inaccurate inferred requirements.

## Configuration

**Priority** (highest → lowest): CLI flags → env vars → config file (`ai-config.json` / YAML) → hardcoded defaults.

Key env vars: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `EXECUTION_MODE`, `LOG_LEVEL`, `DB_CONNECTION_STRING`, `DB_PROVIDER`, `LANGUAGE`.
