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
  ImplementationPlanAgent,
  GitAnalyzerAgent,
  ProjectDiscoveryAgent,
  AttachmentReaderAgent,
  FlowchartGeneratorAgent,
  TechnicalWriterAgent,
  ExecutiveWriterAgent,
  SummaryGeneratorAgent,
  RichPrototypeGeneratorAgent,
  CodeImplementationAgent,
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
import { Logger, ModeManager, RepositoryContextCache } from '../core';
import { LanguageSpecialistAgent } from '../agents/base-language-specialist';
import {
  AnalysisDepth,
  AppConfig,
  CoherenceReport,
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
  enableImplementation?: boolean;
  depth?: AnalysisDepth;
}

/** The orchestrator returns a PipelineResult envelope. */
export type OrchestratorResult = PipelineResult;

/** Shared in-memory cache across Orchestrator instances (persists across MCP calls). */
const globalCache = new RepositoryContextCache();

/** Coordinates the full 18-agent pipeline, passing a shared FeatureContext between agents. */
export class Orchestrator {
  private readonly logger = Logger.child('Orchestrator');

  /** Expose the shared cache for external access (e.g. MCP resources). */
  static get cache(): RepositoryContextCache {
    return globalCache;
  }

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
      enableImplementation, depth = 'standard',
    } = options;
    const startedAt = new Date();
    const TOTAL_STEPS = 20;

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
    this.logger.info(`Pipeline started for ${projectPath} (depth: ${depth})`);
    this.logger.info(`Execution mode: ${effectiveMode}`);

    // ── Try cache for Steps 1-4 ──────────────────────────────────────────
    const cached = globalCache.get(projectPath);
    if (cached) {
      this.logger.info('Using cached repository context');
      fc.repositoryContext = cached.repositoryContext;
      fc.repoIndex = cached.repoIndex;
      fc.gitAnalysis = cached.gitAnalysis as FeatureContext['gitAnalysis'];
      fc.projectDiscovery = cached.projectDiscovery as FeatureContext['projectDiscovery'];
      fc.databaseSummary = cached.databaseSummary;

      // Record cache hits as skipped steps
      for (const [step, agent] of [
        ['1', 'Repository Indexer'], ['2', 'Database Reader'],
        ['3', 'Git Analyzer'], ['4', 'Project Discovery'],
      ]) {
        ctx.steps.push({ stepName: `Step ${step}/${TOTAL_STEPS}`, agent, success: true, skipped: false, durationMs: 0 });
      }
    } else {
      // ── 1. Repository Indexer — CRITICAL: abort pipeline on failure ─────
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

      // ── Steps 2-4: Run in parallel ─────────────────────────────────────
      const [dbResult, gitResult, discoveryResult] = await Promise.allSettled([
        this.executeStep(`Step 2/${TOTAL_STEPS}`, 'Database Reader', () => {
          const agent = new DatabaseReaderAgent();
          return agent.execute(undefined, session);
        }, ctx),
        this.executeStep(`Step 3/${TOTAL_STEPS}`, 'Git Analyzer', () => {
          const agent = new GitAnalyzerAgent();
          return agent.execute(projectPath, session);
        }, ctx),
        this.executeStep(`Step 4/${TOTAL_STEPS}`, 'Project Discovery', () => {
          const agent = new ProjectDiscoveryAgent();
          return agent.execute(projectPath, session);
        }, ctx),
      ]);

      fc.databaseSummary = dbResult.status === 'fulfilled' ? dbResult.value ?? undefined : undefined;
      fc.gitAnalysis = gitResult.status === 'fulfilled' ? gitResult.value ?? undefined : undefined;
      fc.projectDiscovery = discoveryResult.status === 'fulfilled' ? discoveryResult.value ?? undefined : undefined;

      // ── Populate cache ─────────────────────────────────────────────────
      globalCache.set(projectPath, {
        repositoryContext: fc.repositoryContext,
        repoIndex: fc.repoIndex!,
        gitAnalysis: fc.gitAnalysis,
        projectDiscovery: fc.projectDiscovery,
        databaseSummary: fc.databaseSummary,
        projectPath,
      });
    }

    // ── 5. Attachment Reader — conditional on attachPaths ────────────────
    if (attachPaths && attachPaths.length > 0) {
      fc.attachmentContext = await this.executeStep(`Step 5/${TOTAL_STEPS}`, 'Attachment Reader', () => {
        const agent = new AttachmentReaderAgent();
        return agent.execute(attachPaths, session);
      }, ctx) ?? undefined;
    } else {
      ctx.steps.push({ stepName: `Step 5/${TOTAL_STEPS}`, agent: 'Attachment Reader', success: true, skipped: true, durationMs: 0 });
    }

    // ── Quick depth: only core analysis (Steps 6, 7, 12) ────────────────
    const isQuick = depth === 'quick';
    const isDeep = depth === 'deep';

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

    if (!isQuick) {
      // ── 8. Reuse — warning, requires requirements ──────────────────────
      fc.reuseAnalysis = await this.executeStep(`Step 8/${TOTAL_STEPS}`, 'Reuse Analyst', () => {
        const agent = new ReuseAgent();
        return agent.execute(fc, session);
      }, ctx, [fc.requirementsAnalysis]);

      // ── 9. Solution — warning, requires requirements + scope + reuse ───
      fc.solutionArchitecture = await this.executeStep(`Step 9/${TOTAL_STEPS}`, 'Solution Architect', () => {
        const agent = new SolutionArchitectAgent();
        return agent.execute(fc, session);
      }, ctx, [fc.requirementsAnalysis, fc.scopeDefinition, fc.reuseAnalysis]);

      // ── 10. Implementation Plan — requires solution architecture ──────
      fc.implementationPlan = await this.executeStep(`Step 10/${TOTAL_STEPS}`, 'Implementation Plan Architect', () => {
        const agent = new ImplementationPlanAgent();
        return agent.execute(fc, session);
      }, ctx, [fc.solutionArchitecture]);
    } else {
      for (const [step, agent] of [['8', 'Reuse Analyst'], ['9', 'Solution Architect']]) {
        ctx.steps.push({ stepName: `Step ${step}/${TOTAL_STEPS}`, agent, success: true, skipped: true, durationMs: 0 });
      }
    }

    // ── 11. Language Specialists — only in deep mode ─────────────────────
    if (isDeep && enableSpecialists) {
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
            `Step 11/${TOTAL_STEPS}`, specialist.name, () => specialist.execute(fc, session),
            ctx, [fc.solutionArchitecture],
          );
          if (result) analyses.push(result);
        }
      }
      fc.languageAnalyses = analyses.length > 0 ? analyses : undefined;
    } else {
      ctx.steps.push({ stepName: `Step 11/${TOTAL_STEPS}`, agent: 'Language Specialists', success: true, skipped: true, durationMs: 0 });
    }

    if (!isQuick) {
      // ── 12. Impact — warning, requires solution + scope ────────────────
      fc.impactAnalysis = await this.executeStep(`Step 12/${TOTAL_STEPS}`, 'Impact Analyst', () => {
        const agent = new ImpactAnalysisAgent();
        return agent.execute(fc, session);
      }, ctx, [fc.solutionArchitecture, fc.scopeDefinition]);
    } else {
      ctx.steps.push({ stepName: `Step 12/${TOTAL_STEPS}`, agent: 'Impact Analyst', success: true, skipped: true, durationMs: 0 });
    }

    // ── 13. Estimation — always run (core deliverable) ───────────────────
    fc.estimation = await this.executeStep(`Step 13/${TOTAL_STEPS}`, 'Estimation Agent', () => {
      const agent = new EstimationAgent();
      return agent.execute(fc, session);
    }, ctx);

    if (!isQuick) {
      // ── 14. Flowchart Generator — conditional on enableFlowcharts ──────
      if (enableFlowcharts) {
        fc.flowcharts = await this.executeStep(`Step 14/${TOTAL_STEPS}`, 'Flowchart Generator', () => {
          const agent = new FlowchartGeneratorAgent();
          return agent.execute(fc, session);
        }, ctx, [fc.solutionArchitecture]) ?? undefined;
      } else {
        ctx.steps.push({ stepName: `Step 14/${TOTAL_STEPS}`, agent: 'Flowchart Generator', success: true, skipped: true, durationMs: 0 });
      }

      // ── 15. Documentation — warning ────────────────────────────────────
      fc.documentation = await this.executeStep(`Step 15/${TOTAL_STEPS}`, 'Documentation Generator', () => {
        const agent = new DocumentationGeneratorAgent();
        return agent.execute(fc, session);
      }, ctx);
    } else {
      ctx.steps.push({ stepName: `Step 14/${TOTAL_STEPS}`, agent: 'Flowchart Generator', success: true, skipped: true, durationMs: 0 });
      ctx.steps.push({ stepName: `Step 15/${TOTAL_STEPS}`, agent: 'Documentation Generator', success: true, skipped: true, durationMs: 0 });
    }

    // ── 16-17: Executive docs — only in deep or standard+enabled ─────────
    if (!isQuick && enableExecutiveDocs) {
      fc.documentationPackage = fc.documentationPackage ?? { technical: '', executive: '', summary: '', flowcharts: [] };
      const techDoc = await this.executeStep(`Step 16/${TOTAL_STEPS}`, 'Technical Writer', () => {
        const agent = new TechnicalWriterAgent();
        return agent.execute(fc, session);
      }, ctx) ?? undefined;
      if (techDoc && fc.documentationPackage) fc.documentationPackage.technical = techDoc;

      const execDoc = await this.executeStep(`Step 17/${TOTAL_STEPS}`, 'Executive Writer', () => {
        const agent = new ExecutiveWriterAgent();
        return agent.execute(fc, session);
      }, ctx) ?? undefined;
      if (execDoc && fc.documentationPackage) fc.documentationPackage.executive = execDoc;
    } else {
      ctx.steps.push({ stepName: `Step 16/${TOTAL_STEPS}`, agent: 'Technical Writer', success: true, skipped: true, durationMs: 0 });
      ctx.steps.push({ stepName: `Step 17/${TOTAL_STEPS}`, agent: 'Executive Writer', success: true, skipped: true, durationMs: 0 });
    }

    if (!isQuick) {
      // ── 18. Summary Generator ──────────────────────────────────────────
      fc.documentationPackage = fc.documentationPackage ?? { technical: '', executive: '', summary: '', flowcharts: [] };
      const summary = await this.executeStep(`Step 18/${TOTAL_STEPS}`, 'Summary Generator', () => {
        const agent = new SummaryGeneratorAgent();
        return agent.execute(fc, session);
      }, ctx) ?? undefined;
      if (summary && fc.documentationPackage) fc.documentationPackage.summary = summary;
    } else {
      ctx.steps.push({ stepName: `Step 18/${TOTAL_STEPS}`, agent: 'Summary Generator', success: true, skipped: true, durationMs: 0 });
    }

    // ── 19. Prototype / Rich Prototype — only standard/deep ──────────────
    if (!isQuick && generatePrototype && requirements) {
      fc.richPrototype = await this.executeStep(`Step 19/${TOTAL_STEPS}`, 'Rich Prototype Generator', () => {
        const agent = new RichPrototypeGeneratorAgent();
        return agent.execute(fc, session);
      }, ctx) ?? undefined;

      if (!fc.richPrototype) {
        fc.prototype = await this.executeStep(`Step 19/${TOTAL_STEPS}`, 'Prototype Generator', () => {
          const agent = new PrototypeGeneratorAgent();
          return agent.execute(fc, session);
        }, ctx, [generatePrototype, requirements]);
      }
    } else {
      ctx.steps.push({ stepName: `Step 19/${TOTAL_STEPS}`, agent: 'Rich Prototype Generator', success: true, skipped: true, durationMs: 0 });
    }

    // ── 20. Code Implementation — conditional on enableImplementation ────
    if (!isQuick && enableImplementation) {
      fc.implementation = await this.executeStep(`Step 20/${TOTAL_STEPS}`, 'Code Implementation', () => {
        const agent = new CodeImplementationAgent();
        return agent.execute(fc, session);
      }, ctx, [fc.solutionArchitecture]) ?? undefined;
    } else {
      ctx.steps.push({ stepName: `Step 20/${TOTAL_STEPS}`, agent: 'Code Implementation', success: true, skipped: true, durationMs: 0 });
    }

    // ── Coherence validation (standard + deep) ───────────────────────────
    if (!isQuick && fc.requirementsAnalysis && fc.scopeDefinition) {
      fc.coherenceReport = this.validateCoherence(fc);
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

  // ── Coherence Validation ───────────────────────────────────────────────

  private validateCoherence(fc: FeatureContext): CoherenceReport {
    const req = fc.requirementsAnalysis!;
    const scope = fc.scopeDefinition!;
    const estimation = fc.estimation;
    const impact = fc.impactAnalysis;

    const uncoveredRequirements: string[] = [];
    const scopeWithoutRequirement: string[] = [];
    const estimationGaps: string[] = [];
    const riskMismatch: string[] = [];
    const suggestions: string[] = [];

    // Check if all functional requirements have scope items
    const allReqs = [...req.functionalRequirements, ...req.nonFunctionalRequirements];
    const scopeDescriptions = scope.inScope.map((s) => s.description.toLowerCase()).join(' ');
    const scopeAreas = scope.inScope.map((s) => s.area.toLowerCase()).join(' ');

    for (const r of allReqs) {
      const keywords = r.description.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const covered = keywords.some((k) => scopeDescriptions.includes(k) || scopeAreas.includes(k));
      if (!covered && r.priority === 'must') {
        uncoveredRequirements.push(`${r.id}: ${r.description}`);
      }
    }

    // Check scope items without matching requirements
    for (const s of scope.inScope.filter((s) => s.type === 'new')) {
      const areaLower = s.area.toLowerCase();
      const matchesAnyReq = allReqs.some((r) =>
        r.description.toLowerCase().includes(areaLower.replace(/-module$/, '')),
      );
      if (!matchesAnyReq) {
        scopeWithoutRequirement.push(`${s.area}: ${s.description}`);
      }
    }

    // Check estimation gaps
    if (estimation && fc.solutionArchitecture) {
      const estimatedComponents = new Set(
        estimation.breakdown.map((b) => b.task.toLowerCase()),
      );
      for (const comp of fc.solutionArchitecture.proposedComponents.filter((c) => c.isNew)) {
        const compLower = comp.name.toLowerCase();
        const hasEstimation = [...estimatedComponents].some((e) => e.includes(compLower));
        if (!hasEstimation) {
          estimationGaps.push(`${comp.name} (${comp.type}) sem estimativa`);
        }
      }
    }

    // Check risk ↔ estimation alignment
    if (impact && estimation) {
      if (impact.riskLevel === 'high' && estimation.confidence === 'high') {
        riskMismatch.push('Risco alto com confiança alta na estimativa — considerar buffer adicional');
      }
      if (impact.migrationNotes.length > 0 && !estimation.breakdown.some((b) =>
        b.task.toLowerCase().includes('migra'))) {
        riskMismatch.push('Migrações identificadas mas não estimadas');
      }
    }

    // Generate suggestions
    if (uncoveredRequirements.length > 0) {
      suggestions.push(`Adicionar cobertura de escopo para ${uncoveredRequirements.length} requisito(s) sem cobertura`);
    }
    if (scopeWithoutRequirement.length > 0) {
      suggestions.push(`Revisar ${scopeWithoutRequirement.length} item(ns) de escopo sem requisito justificador`);
    }
    if (estimationGaps.length > 0) {
      suggestions.push(`Incluir estimativa para ${estimationGaps.length} componente(s) não estimado(s)`);
    }
    if (riskMismatch.length > 0) {
      suggestions.push(`Alinhar avaliação de risco com estimativa: ${riskMismatch.join('; ')}`);
    }

    const total = uncoveredRequirements.length + scopeWithoutRequirement.length +
      estimationGaps.length + riskMismatch.length;
    const maxPenalty = allReqs.length + scope.inScope.length;
    const coherenceScore = maxPenalty > 0
      ? Math.max(0, Math.round((1 - total / maxPenalty) * 100))
      : 100;

    return { uncoveredRequirements, scopeWithoutRequirement, estimationGaps, riskMismatch, suggestions, coherenceScore };
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
