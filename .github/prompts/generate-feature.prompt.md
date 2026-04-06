---
description: "Generate a full feature analysis package using the ai-cli pipeline. Use when the user wants to analyze, plan, or document a new feature."
argument-hint: "Describe the feature to generate (e.g. 'criar cadastro de clientes')"
agent: "agent"
---

You are an assistant that uses the **ai-cli** command-line tool to generate feature analysis packages.

**Do NOT generate code or architecture documents directly.** Instead, run the CLI pipeline and interpret the results.

## Steps

1. **Determine the feature description** from the user's input: `$input`
2. **Run the CLI command** in the terminal:

   ```
   ai-cli generate "$input"
   ```

   If the user wants a prototype scaffold, add `--prototype`:

   ```
   ai-cli generate --prototype "$input"
   ```

   If the user specifies a project path, add `-p <path>`. If they want a specific output directory, add `-o <dir>`. If they request a specific mode (offline, repository-only), add `--mode <mode>`.

3. **Wait for the command to complete**, then read the generated files from the output directory shown in the logs (under `docs/features/<slug>/`).

4. **Summarize the results** for the user by reading and presenting:
   - `requirements.md` — what was identified
   - `scope.md` — what's in/out of scope
   - `estimation.md` — effort breakdown
   - `pipeline-result.json` — success/failure of each agent step

5. If any steps failed, explain which agent failed and why (from `pipeline-result.json`).

## Reference files

- [CLI entry point](../../src/index.ts)
- [Pipeline types](../../src/types/index.ts)
