import { AgentResult, AgentRole, SessionContext } from '../types';

/** Base contract every agent must implement. */
export interface IAgent<TInput = unknown, TOutput = unknown> {
  readonly role: AgentRole;
  readonly name: string;
  execute(input: TInput, context: SessionContext): Promise<AgentResult<TOutput>>;
}
