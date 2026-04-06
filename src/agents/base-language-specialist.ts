import { BaseAgent } from '../core';
import { FeatureContext, LanguageSpecificAnalysis, SessionContext } from '../types';

/**
 * Abstract base for language-specific specialist agents.
 * Each specialist checks if its target language is present in the repository
 * and, if so, performs specialized analysis.
 */
export abstract class LanguageSpecialistAgent
  extends BaseAgent<FeatureContext, LanguageSpecificAnalysis> {

  abstract readonly targetLanguage: string;

  public isRelevant(fc: FeatureContext): boolean {
    if (!fc.repositoryContext) return false;
    return fc.repositoryContext.languages.some(
      (l) => l.language.toLowerCase().includes(this.targetLanguage.toLowerCase()),
    );
  }

  protected async run(fc: FeatureContext, ctx: SessionContext): Promise<LanguageSpecificAnalysis> {
    if (!this.isRelevant(fc)) {
      this.logger.info(`${this.targetLanguage} not detected — skipping`);
      return {
        language: this.targetLanguage,
        patterns: [],
        conventions: [],
        recommendations: [],
        codeSmells: [],
        bestPractices: [],
      };
    }
    return this.withLlmFallback(
      () => this.llmAnalyze(fc, ctx),
      () => this.offlineAnalyze(fc),
    );
  }

  protected async llmAnalyze(_fc: FeatureContext, _ctx: SessionContext): Promise<LanguageSpecificAnalysis> {
    // Subclasses can override to call LLM with their specific prompt
    return this.offlineAnalyze(_fc);
  }

  protected abstract offlineAnalyze(fc: FeatureContext): Promise<LanguageSpecificAnalysis>;
}
