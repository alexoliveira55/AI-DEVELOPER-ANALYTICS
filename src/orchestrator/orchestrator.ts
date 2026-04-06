import * as crypto from 'crypto';
import {
  DatabaseReaderAgent,
  DocumentationGeneratorAgent,
  EstimationAgent,
  ImpactAnalysisAgent,
  PrototypeGeneratorAgent,
  RepositoryIndexerAgent,
  RequirementsAgent,
  ReuseAgent,
  ScopeAgent,
  SolutionArchitectAgent,
  GitAnalyzerAgent,
  ProjectDiscoveryAgent,
  AttachmentReaderAgent,
  FlowchartGeneratorAgent,
  TechnicalWriterAgent,
  ExecutiveWriterAgent,
  SummaryGeneratorAgent,
  RichPrototypeGeneratorAgent,
} from '../agents';
import {
  FlutterDartSpecialistAgent,
  CSharpDotNetSpecialistAgent,
  SqlSpecialistAgent,
  VisualFoxProSpecialistAgent,
  AngularSpecialistAgent,
  PythonSpecialistAgent,
  WebSpecialistAgent,
} from '../agents';
import { Logger, ModeManager } from '../core';
import { LanguageSpecialistAgent } from '../agents/base-language-specialist';
import {
  AppConfig,
  ExecutionMode,
  FeatureContext,
  LanguageSpecificAnalysis,
  PipelineResult,
  RepoIndex,
  SessionContext,
  StepResult,
} from '../types';

type PipelineContext = { steps: StepResult[]; errors: string[]; warnings: string[] };

export interface OrchestratorOptions {
  projectPath: string;
  config: AppConfig;
  requirements?: string;
  generatePrototype?: boolean;
  mode?: string;
  attachPaths?: string[];
  enableSpecialists?: boolean;
  enableFlowcharts?: boolean;
  enableExecutiveDocs?: boolean;
}

/** The orchestrator returns a PipelineResult envelope. */
export type OrchestratorResult = PipelineResult;

/** Coordinates the full 18-agent pipeline, passing a shared FeatureContext between agents. */
export class Orchestrator {
  private readonly logger = Logger.child('Orchestrator');

  /**
   * Run a single pipeline step with prerequisite checking, timing, and error capture.
   *
   * @param stepName    Human-readable label (e.g. "Step 3/10")
   * @param agentName   Name of the agent being executed
   * @param fn          Factory that returns the agent result promise
   * @param context     Mutable pipeline context: steps, errors, warnings arrays
   * @param prerequisites Optional array of values that must all be truthy; if any
   *                      is falsy the step is skipped and a warning is recorded.
   */
  private async executeStep<T>(
    stepName: string,
    agentName: string,
    fn: () => Promise<{ success: boolean; data?: T; error?: string }>,
    context: { steps: StepResult[]; errors: string[]; warnings: string[] },
    prerequisites?: unknown[],
  ): Promise<T | undefined> {
    // Skip if agent is not allowed in current execution mode
    if (!ModeManager.isAgentAllowed(agentName)) {
      const msg = `${stepName}: ${agentName} skipped (not allowed in ${ModeManager.getMode()} mode)`;
      this.logger.info(msg);
      context.steps.push({ stepName, agent: agentName, success: true, skipped: true, durationMs: 0 });
      return undefined;
    }

    // In REPOSITORY_ONLY mode, don't enforce prerequisites — allowed agents
    // must work with whatever context is available.
    const enforcePrereqs = ModeManager.getMode() !== ExecutionMode.REPOSITORY_ONLY;

    // Skip when prerequisites are declared and at least one is falsy
    if (enforcePrereqs && prerequisites && prerequisites.some((p) => !p)) {
      const msg = `${stepName}: ${agentName} skipped (missing prerequisites)`;
      this.logger.warn(msg);
      context.warnings.push(msg);
      context.steps.push({ stepName, agent: agentName, success: true, skipped: true, durationMs: 0 });
      return undefined;
    }

    this.logger.info(`${stepName}: ${agentName}…`);
    const t0 = Date.now();

    try {
      const result = await fn();
      const durationMs = Date.now() - t0;

      if (result.success && result.data !== undefined) {
        context.steps.push({ stepName, agent: agentName, success: true, skipped: false, durationMs });
        this.logger.info(`${stepName}: ${agentName} completed in ${durationMs}ms`);
        return result.data;
      }

      const errMsg = result.error ?? 'Unknown error';
      context.steps.push({ stepName, agent: agentName, success: false, skipped: false, error: errMsg, durationMs });
      context.errors.push(`${agentName}: ${errMsg}`);
      this.logger.warn(`${agentName} failed in ${durationMs}ms: ${errMsg}`);
      return undefined;
    } catch (err) {
      const durationMs = Date.now() - t0;
      const errMsg = err instanceof Error ? err.message : String(err);
      context.steps.push({ stepName, agent: agentName, success: false, skipped: false, error: errMsg, durationMs });
      context.errors.push(`${agentName}: ${errMsg}`);
      this.logger.warn(`${agentName} failed in ${durationMs}ms: ${errMsg}`);
      return undefined;
    }
  }

  async run(options: OrchestratorOptions): Promise<OrchestratorResult> {
    const {
      projectPath, config, requirements, generatePrototype, mode,
      attachPaths, enableSpecialists, enableFlowcharts, enableExecutiveDocs,
    } = options;
    const startedAt = new Date();
    const TOTAL_STEPS = 18;

    const effectiveMode = ModeManager.resolve(mode, config.executionMode);

    const session: SessionContext = {
      sessionId: crypto.randomUUID(),
      projectPath,
      config,
      artifacts: new Map(),
    };

    const fc: FeatureContext = { rawRequirements: requirements };
    const ctx: PipelineContext = { steps: [], errors: [], warnings: [] };

    Logger.setSessionId(session.sessionId);
    this.logger.info(`Pipeline started for ${projectPath}`);
    this.logger.info(`Execution mode: ${effectiveMode}`);

    // ── 1. Repository Indexer — CRITICAL: abort pipeline on failure ───────
    const indexData = await this.executeStep(`Step 1/${TOTAL_STEPS}`, 'Repository Indexer', () => {
      const agent = new RepositoryIndexerAgent();
      return agent.execute(projectPath, session);
    }, ctx);

    if (!indexData) {
      const completedAt = new Date();
      this.logger.error('Pipeline aborted: Repository indexing failed');
      return {
        success: false,
        sessionId: session.sessionId,
        featureName: requirements ?? '',
        executionMode: ModeManager.getMode(),
        steps: ctx.steps,
        errors: ctx.errors,
        warnings: ctx.warnings,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        context: fc,
      };
    }
    fc.repositoryContext = indexData;
    fc.repoIndex = this.buildRepoIndex(fc);

    // ── 2. Database Reader — warning on failure ──────────────────────────
    fc.databaseSummary = await this.executeStep(`Step 2/${TOTAL_STEPS}`, 'Database Reader', () => {
      const agent = new DatabaseReaderAgent();
      return agent.execute(undefined, session);
    }, ctx) ?? undefined;

    // ── 3. Git Analyzer — warning on failure ─────────────────────────────
    fc.gitAnalysis = await this.executeStep(`Step 3/${TOTAL_STEPS}`, 'Git Analyzer', () => {
      const agent = new GitAnalyzerAgent();
      return agent.execute(projectPath, session);
    }, ctx) ?? undefined;

    // ── 4. Project Discovery — warning on failure ────────────────────────
    fc.projectDiscovery = await this.executeStep(`Step 4/${TOTAL_STEPS}`, 'Project Discovery', () => {
      const agent = new ProjectDiscoveryAgent();
      return agent.execute(projectPath, session);
    }, ctx) ?? undefined;

    // ── 5. Attachment Reader — conditional on attachPaths ────────────────
    if (attachPaths && attachPaths.length > 0) {
      fc.attachmentContext = await this.executeStep(`Step 5/${TOTAL_STEPS}`, 'Attachment Reader', () => {
        const agent = new AttachmentReaderAgent();
        return agent.execute(attachPaths, session);
      }, ctx) ?? undefined;
    } else {
      ctx.steps.push({ stepName: `Step 5/${TOTAL_STEPS}`, agent: 'Attachment Reader', success: true, skipped: true, durationMs: 0 });
    }

    // ── 6. Requirements — warning on failure, dependents will skip ───────
    fc.requirementsAnalysis = await this.executeStep(`Step 6/${TOTAL_STEPS}`, 'Requirements Analyst', () => {
      const agent = new RequirementsAgent();
      return agent.execute(fc, session);
    }, ctx, [requirements]);

    // ── 7. Scope — warning, requires requirements ────────────────────────
    fc.scopeDefinition = await this.executeStep(`Step 7/${TOTAL_STEPS}`, 'Scope Analyst', () => {
      const agent = new ScopeAgent();
      return agent.execute(fc, session);
    }, ctx, [fc.requirementsAnalysis]);

    // ── 8. Reuse — warning, requires requirements ────────────────────────
    fc.reuseAnalysis = await this.executeStep(`Step 8/${TOTAL_STEPS}`, 'Reuse Analyst', () => {
      const agent = new ReuseAgent();
      return agent.execute(fc, session);
    }, ctx, [fc.requirementsAnalysis]);

    // ── 9. Solution — warning, requires requirements + scope + reuse ─────
    fc.solutionArchitecture = await this.executeStep(`Step 9/${TOTAL_STEPS}`, 'Solution Architect', () => {
      const agent = new SolutionArchitectAgent();
      return agent.execute(fc, session);
    }, ctx, [fc.requirementsAnalysis, fc.scopeDefinition, fc.reuseAnalysis]);

    // ── 10. Language Specialists — conditional on enableSpecialists ──────
    if (enableSpecialists) {
      const specialists: LanguageSpecialistAgent[] = [
        new FlutterDartSpecialistAgent(),
        new CSharpDotNetSpecialistAgent(),
        new SqlSpecialistAgent(),
        new VisualFoxProSpecialistAgent(),
        new AngularSpecialistAgent(),
        new PythonSpecialistAgent(),
        new WebSpecialistAgent(),
      ];

      const analyses: LanguageSpecificAnalysis[] = [];
      for (const specialist of specialists) {
        if (specialist.isRelevant(fc)) {
          const result = await this.executeStep(
            `Step 10/${TOTAL_STEPS}`, specialist.name, () => specialist.execute(fc, session),
            ctx, [fc.solutionArchitecture],
          );
          if (result) analyses.push(result);
        }
      }
      fc.languageAnalyses = analyses.length > 0 ? analyses : undefined;
    } else {
      ctx.steps.push({ stepName: `Step 10/${TOTAL_STEPS}`, agent: 'Language Specialists', success: true, skipped: true, durationMs: 0 });
    }

    // ── 11. Impact — warning, requires solution + scope ──────────────────
    fc.impactAnalysis = await this.executeStep(`Step 11/${TOTAL_STEPS}`, 'Impact Analyst', () => {
      const agent = new ImpactAnalysisAgent();
      return agent.execute(fc, session);
    }, ctx, [fc.solutionArchitecture, fc.scopeDefinition]);

    // ── 12. Estimation — warning ─────────────────────────────────────────
    fc.estimation = await this.executeStep(`Step 12/${TOTAL_STEPS}`, 'Estimation Agent', () => {
      const agent = new EstimationAgent();
      return agent.execute(fc, session);
    }, ctx);

    // ── 13. Flowchart Generator — conditional on enableFlowcharts ────────
    if (enableFlowcharts) {
      fc.flowcharts = await this.executeStep(`Step 13/${TOTAL_STEPS}`, 'Flowchart Generator', () => {
        const agent = new FlowchartGeneratorAgent();
        return agent.execute(fc, session);
      }, ctx, [fc.solutionArchitecture]) ?? undefined;
    } else {
      ctx.steps.push({ stepName: `Step 13/${TOTAL_STEPS}`, agent: 'Flowchart Generator', success: true, skipped: true, durationMs: 0 });
    }

    // ── 14. Documentation — warning ──────────────────────────────────────
    fc.documentation = await this.executeStep(`Step 14/${TOTAL_STEPS}`, 'Documentation Generator', () => {
      const agent = new DocumentationGeneratorAgent();
      return agent.execute(fc, session);
    }, ctx);

    // ── 15. Technical Writer — conditional on enableExecutiveDocs ─────────
    if (enableExecutiveDocs) {
      fc.documentationPackage = fc.documentationPackage ?? { technical: '', executive: '', summary: '', flowcharts: [] };
      const techDoc = await this.executeStep(`Step 15/${TOTAL_STEPS}`, 'Technical Writer', () => {
        const agent = new TechnicalWriterAgent();
        return agent.execute(fc, session);
      }, ctx) ?? undefined;
      if (techDoc && fc.documentationPackage) fc.documentationPackage.technical = techDoc;
    } else {
      ctx.steps.push({ stepName: `Step 15/${TOTAL_STEPS}`, agent: 'Technical Writer', success: true, skipped: true, durationMs: 0 });
    }

    // ── 16. Executive Writer — conditional on enableExecutiveDocs ─────────
    if (enableExecutiveDocs) {
      fc.documentationPackage = fc.documentationPackage ?? { technical: '', executive: '', summary: '', flowcharts: [] };
      const execDoc = await this.executeStep(`Step 16/${TOTAL_STEPS}`, 'Executive Writer', () => {
        const agent = new ExecutiveWriterAgent();
        return agent.execute(fc, session);
      }, ctx) ?? undefined;
      if (execDoc && fc.documentationPackage) fc.documentationPackage.executive = execDoc;
    } else {
      ctx.steps.push({ stepName: `Step 16/${TOTAL_STEPS}`, agent: 'Executive Writer', success: true, skipped: true, durationMs: 0 });
    }

    // ── 17. Summary Generator ────────────────────────────────────────────
    fc.documentationPackage = fc.documentationPackage ?? { technical: '', executive: '', summary: '', flowcharts: [] };
    const summary = await this.executeStep(`Step 17/${TOTAL_STEPS}`, 'Summary Generator', () => {
      const agent = new SummaryGeneratorAgent();
      return agent.execute(fc, session);
    }, ctx) ?? undefined;
    if (summary && fc.documentationPackage) fc.documentationPackage.summary = summary;

    // ── 18. Prototype / Rich Prototype ───────────────────────────────────
    if (generatePrototype && requirements) {
      fc.richPrototype = await this.executeStep(`Step 18/${TOTAL_STEPS}`, 'Rich Prototype Generator', () => {
        const agent = new RichPrototypeGeneratorAgent();
        return agent.execute(fc, session);
      }, ctx) ?? undefined;

      // Also run legacy prototype as fallback
      if (!fc.richPrototype) {
        fc.prototype = await this.executeStep(`Step 18/${TOTAL_STEPS}`, 'Prototype Generator', () => {
          const agent = new PrototypeGeneratorAgent();
          return agent.execute(fc, session);
        }, ctx, [generatePrototype, requirements]);
      }
    } else {
      ctx.steps.push({ stepName: `Step 18/${TOTAL_STEPS}`, agent: 'Rich Prototype Generator', success: true, skipped: true, durationMs: 0 });
    }

    const completedAt = new Date();
    const totalMs = completedAt.getTime() - startedAt.getTime();

    const succeeded = ctx.steps.filter((s) => s.success && !s.skipped).length;
    const failed = ctx.steps.filter((s) => !s.success).length;
    const skipped = ctx.steps.filter((s) => s.skipped).length;

    this.logger.info(
      `Pipeline completed in ${totalMs}ms — ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`,
    );

    return {
      success: ctx.errors.length === 0,
      sessionId: session.sessionId,
      featureName: requirements ?? '',
      executionMode: ModeManager.getMode(),
      steps: ctx.steps,
      errors: ctx.errors,
      warnings: ctx.warnings,
      durationMs: totalMs,
      context: fc,
    };
  }

  private buildRepoIndex(fc: FeatureContext): RepoIndex {
    const repo = fc.repositoryContext!;
    return {
      files: repo.languages.map((l) => ({
        path: l.language,
        language: l.language,
        lines: l.lines,
        size: 0,
      })),
      languages: Object.fromEntries(
        repo.languages.map((l) => [l.language, l.lines]),
      ),
      totalLines: repo.meta.totalLines,
      dependencies: repo.frameworks.map((f) => f.name),
    };
  }
}
