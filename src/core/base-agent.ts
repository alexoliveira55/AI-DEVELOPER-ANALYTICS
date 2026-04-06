import { AgentResult, AgentRole, SessionContext } from '../types';
import { IAgent } from './agent.interface';
import { Logger } from './logger';
import { ModeManager } from './mode-manager';

/** Convenience base class with logging and error handling. */
export abstract class BaseAgent<TInput = unknown, TOutput = unknown>
  implements IAgent<TInput, TOutput>
{
  abstract readonly role: AgentRole;
  abstract readonly name: string;

  protected readonly logger = Logger.child(this.constructor.name);

  async execute(input: TInput, context: SessionContext): Promise<AgentResult<TOutput>> {
    this.logger.info(`[${this.name}] Starting execution`);
    try {
      const data = await this.run(input, context);
      this.logger.info(`[${this.name}] Completed successfully`);
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${this.name}] Failed: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Try the LLM path first; if LLM is unavailable or the call fails,
   * fall back to the offline/template path automatically.
   */
  protected async withLlmFallback<R>(
    llmFn: () => Promise<R>,
    offlineFn: () => Promise<R>,
  ): Promise<R> {
    if (!ModeManager.isLlmAvailable()) {
      return offlineFn();
    }
    try {
      return await llmFn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LLM call failed, falling back to offline: ${msg}`);
      ModeManager.fallbackToOffline();
      return offlineFn();
    }
  }

  /** Subclasses implement their core logic here. */
  protected abstract run(input: TInput, context: SessionContext): Promise<TOutput>;
}
