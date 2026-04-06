import { ExecutionMode } from '../types';
import { Logger } from './logger';

/** Agents allowed in REPOSITORY_ONLY mode. */
const REPOSITORY_ONLY_AGENTS = new Set([
  'Repository Indexer',
  'Git Analyzer',
  'Project Discovery',
  'Attachment Reader',
  'Reuse Analyst',
  'Impact Analyst',
  'Estimation Agent',
  'Documentation Generator',
  'Flowchart Generator',
  'Technical Writer',
  'Executive Writer',
  'Summary Generator',
]);

/**
 * Resolves and tracks the active execution mode for the current pipeline run.
 *
 * Priority: CLI flag → config file → EXECUTION_MODE env var → default (LLM_ONLINE).
 */
export class ModeManager {
  private static readonly logger = Logger.child('ModeManager');
  private static currentMode: ExecutionMode = ExecutionMode.LLM_ONLINE;

  /** Resolve the effective mode. Accepts raw strings from CLI / config. */
  static resolve(cliMode?: string, configMode?: string): ExecutionMode {
    const raw = cliMode ?? configMode ?? process.env.EXECUTION_MODE;

    if (raw) {
      const normalized = raw.toLowerCase().replace(/_/g, '-');
      if (Object.values(ExecutionMode).includes(normalized as ExecutionMode)) {
        this.currentMode = normalized as ExecutionMode;
      } else {
        this.logger.warn(`Unknown execution mode "${raw}", defaulting to llm-online`);
        this.currentMode = ExecutionMode.LLM_ONLINE;
      }
    } else {
      this.currentMode = ExecutionMode.LLM_ONLINE;
    }

    this.logger.info(`Execution mode: ${this.currentMode}`);
    return this.currentMode;
  }

  static getMode(): ExecutionMode {
    return this.currentMode;
  }

  /** Returns true if the agent is permitted to run in the current mode. */
  static isAgentAllowed(agentName: string): boolean {
    if (this.currentMode !== ExecutionMode.REPOSITORY_ONLY) return true;
    return REPOSITORY_ONLY_AGENTS.has(agentName);
  }

  /** Returns true when the current mode permits LLM API calls. */
  static isLlmAvailable(): boolean {
    return this.currentMode === ExecutionMode.LLM_ONLINE;
  }

  /** Downgrade from LLM_ONLINE to LLM_OFFLINE after an LLM failure. */
  static fallbackToOffline(): void {
    if (this.currentMode === ExecutionMode.LLM_ONLINE) {
      this.logger.warn('LLM unavailable — falling back to LLM_OFFLINE mode');
      this.currentMode = ExecutionMode.LLM_OFFLINE;
    }
  }
}
