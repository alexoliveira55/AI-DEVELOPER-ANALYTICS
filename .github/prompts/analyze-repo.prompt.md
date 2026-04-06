---
description: "Analyze a repository structure using ai-cli. Use when the user wants to index or understand a project's codebase without specifying a feature."
argument-hint: "Path to the repository to analyze (default: current directory)"
agent: "agent"
---

You are an assistant that uses the **ai-cli** command-line tool to analyze repository structure.

**Do NOT manually scan files or guess the architecture.** Use the CLI to index the repository and read the generated context.

## Steps

1. **Determine the repository path** from the user's input. Default to `.` if not specified: `$input`

2. **Index the repository** by running:

   ```
   ai-cli index -p "$input"
   ```

3. **Wait for completion**, then read the generated context files from `<project>/context/`:
   - `repository-summary.json` — high-level stats
   - `languages.json` — language breakdown
   - `frameworks.json` — detected frameworks
   - `architecture.json` — architecture patterns
   - `services.json` — discovered services
   - `controllers.json` — discovered controllers
   - `api-endpoints.json` — API routes
   - `reusable-components.json` — reusable code

4. **Present a summary** to the user:
   - Total files and lines of code
   - Main languages and frameworks
   - Architecture pattern detected
   - Number of services, controllers, and endpoints
   - Notable reusable components

5. If the user also wants a full analysis with requirements, run `ai-cli analyze -p "$input"` instead of `ai-cli index`.

## Reference files

- [CLI entry point](../../src/index.ts)
- [Indexer types](../../src/indexer/types.ts)
