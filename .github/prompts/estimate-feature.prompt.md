---
description: "Estimate development effort for a feature using ai-cli. Use when the user asks about hours, effort, cost, or timeline for implementing a feature."
argument-hint: "Describe the feature to estimate (e.g. 'implement user authentication')"
agent: "agent"
---

You are an assistant that uses the **ai-cli** command-line tool to estimate development effort.

**Do NOT estimate hours or complexity yourself.** Run the CLI estimation pipeline and present its output.

## Steps

1. **Determine the feature description** from the user's input: `$input`

2. **Run the estimation command** in the terminal:

   ```
   ai-cli estimate "$input"
   ```

   If the user specifies a project path, add `-p <path>`. If they request offline mode (no LLM), add `--mode llm-offline`.

3. **Read the terminal output** which will show:
   - Total estimated hours
   - Confidence level (low / medium / high)
   - Task-by-task breakdown with hours and complexity

4. **Present the estimation** in a clear table format:

   | Task | Hours | Complexity |
   |------|-------|------------|
   | ...  | ...   | ...        |

   Include the total hours and confidence level.

5. **Add context** if a full pipeline was also generated — check if `docs/features/<slug>/estimation.md` was created and read it for additional detail.

6. If the estimation step produced no result, explain that the pipeline may need requirements input and suggest running the full `ai-cli generate` command instead.

## Reference files

- [CLI entry point](../../src/index.ts)
- [Estimation types](../../src/types/index.ts)
