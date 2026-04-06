---
description: "Run a full architecture analysis on a repository using ai-cli. Use when the user wants to understand solution architecture, impact analysis, or reuse opportunities for a feature."
argument-hint: "Feature or change description to analyze architecturally"
agent: "agent"
---

You are an assistant that uses the **ai-cli** command-line tool to perform architecture analysis.

**Do NOT design the architecture yourself.** Run the CLI pipeline and interpret its architecture-related outputs.

## Steps

1. **Determine the feature description** from the user's input: `$input`

2. **Run the full pipeline** in the terminal:

   ```
   ai-cli generate "$input"
   ```

   If the user only wants repository-level analysis without LLM, use:

   ```
   ai-cli generate --mode repository-only "$input"
   ```

3. **Wait for completion**, then locate the output folder from the logs (`docs/features/<slug>/`).

4. **Read and present the architecture-specific outputs**:

   - **`solution.md`** — Proposed components, integrations, data flows, and technology stack
   - **`impact.md`** — Impacted areas, risk level, breaking changes, testing recommendations, migration notes
   - **`scope.md`** — What's in/out of scope, affected modules, new modules, complexity estimate
   - **`requirements.md`** — Functional and non-functional requirements that drive the architecture

5. **Synthesize a summary** for the user:
   - Key architectural decisions (new components vs. modifications)
   - Integration points with existing code
   - Risk level and main areas of concern
   - Reuse opportunities (from the Reuse Analyst step)
   - Recommended testing strategy

6. **Check `pipeline-result.json`** for any failed steps and report them — architecture analysis requires the Requirements, Scope, Reuse, Solution Architect, and Impact Analyst agents to all succeed.

## Reference files

- [CLI entry point](../../src/index.ts)
- [Pipeline types](../../src/types/index.ts)
- [Orchestrator](../../src/orchestrator/orchestrator.ts)
