import { BaseAgent } from '../core';
import { Labels } from '../config';
import {
  AgentRole,
  Estimation,
  EstimationItem,
  FeatureContext,
  SessionContext,
} from '../types';

/**
 * Estimates effort with granular breakdown based on repository metrics,
 * component types, integration complexity, framework-specific overhead,
 * database impact, and testing requirements. Produces task-level hours
 * tied to specific components and files rather than generic categories.
 */
export class EstimationAgent extends BaseAgent<FeatureContext, Estimation> {
  readonly role = AgentRole.Estimator;
  readonly name = 'Estimation Agent';

  private static readonly HOURS_PER_NEW_COMPONENT: Record<string, number> = {
    service: 8, controller: 6, repository: 6, model: 2,
    migration: 3, middleware: 4, utility: 3,
  };

  private static readonly HOURS_PER_MODIFIED_COMPONENT: Record<string, number> = {
    service: 4, controller: 3, repository: 3, model: 1,
    middleware: 2, utility: 2,
  };

  protected async run(fc: FeatureContext, _context: SessionContext): Promise<Estimation> {
    const repo = fc.repositoryContext;
    const repoIndex = fc.repoIndex;
    const scope = fc.scopeDefinition;
    const impact = fc.impactAnalysis;
    const solution = fc.solutionArchitecture;
    const reuse = fc.reuseAnalysis;
    const breakdown: EstimationItem[] = [];

    // ── Context comprehension (scoped to affected area only) ─
    if (repoIndex && scope) {
      const affectedModuleCount = scope.affectedModules.length;
      const totalLines = repoIndex.totalLines;
      // Estimate comprehension based on affected scope, not entire codebase
      const scopeRatio = Math.min(1, (affectedModuleCount * 500) / Math.max(totalLines, 1));
      const comprehensionHours = Math.max(1, Math.round(totalLines * scopeRatio / 500 * 10) / 10);
      const complexity: EstimationItem['complexity'] =
        affectedModuleCount > 5 ? 'high' : affectedModuleCount > 2 ? 'medium' : 'low';
      breakdown.push({
        task: Labels.estimation.codebaseComprehension(affectedModuleCount, totalLines.toLocaleString()),
        hours: comprehensionHours,
        complexity,
      });
    }

    // ── New component implementation ──────────────────────
    if (solution) {
      for (const comp of solution.proposedComponents.filter((c) => c.isNew)) {
        const baseHours = EstimationAgent.HOURS_PER_NEW_COMPONENT[comp.type] ?? 4;

        // Adjust based on dependencies → more deps = more wiring time
        const depMultiplier = 1 + (comp.dependencies.length * 0.15);

        // Adjust for reuse discount
        const reuseDiscount = (reuse?.candidates.filter((c) => c.relevance === 'high').length ?? 0) > 0 ? 0.85 : 1.0;

        const hours = Math.round(baseHours * depMultiplier * reuseDiscount * 10) / 10;
        const complexity: EstimationItem['complexity'] =
          comp.dependencies.length > 2 ? 'high' : comp.dependencies.length > 0 ? 'medium' : 'low';

        breakdown.push({
          task: Labels.estimation.implement(comp.name, comp.type),
          hours,
          complexity,
        });
      }

      // ── Component modifications — context-aware hours ────
      for (const comp of solution.proposedComponents.filter((c) => !c.isNew)) {
        const baseHours = EstimationAgent.HOURS_PER_MODIFIED_COMPONENT[comp.type] ?? 3;

        // Find original component for sizing
        const existingSvc = repo?.services.find((s) => s.name === comp.name);
        const existingCtrl = repo?.controllers.find((c) => c.name === comp.name);
        const methodCount = existingSvc?.methods.length ?? existingCtrl?.actions.length ?? 0;
        const sizeMultiplier = methodCount > 10 ? 1.5 : methodCount > 5 ? 1.2 : 1.0;
        const hours = Math.round(baseHours * sizeMultiplier * 10) / 10;

        const filePath = existingSvc?.filePath ?? existingCtrl?.filePath ?? '';
        breakdown.push({
          task: Labels.estimation.modify(comp.name, filePath, methodCount),
          hours,
          complexity: methodCount > 10 ? 'high' : 'medium',
        });
      }

      // ── Integration wiring ──────────────────────────────
      if (solution.integrations.length > 0) {
        const depIntegrations = solution.integrations.filter((i) => i.type === 'dependency');
        const crossSvcIntegrations = solution.integrations.filter((i) => i.type === 'cross-service');
        const optionalIntegrations = solution.integrations.filter((i) => i.type === 'optional');

        if (depIntegrations.length > 0) {
          breakdown.push({
            task: Labels.estimation.dependencyWiring(depIntegrations.length),
            hours: depIntegrations.length * 1.5,
            complexity: depIntegrations.length > 3 ? 'high' : 'medium',
          });
        }
        if (crossSvcIntegrations.length > 0) {
          breakdown.push({
            task: Labels.estimation.crossServiceIntegration(crossSvcIntegrations.length),
            hours: crossSvcIntegrations.length * 2.5,
            complexity: 'high',
          });
        }
        if (optionalIntegrations.length > 0) {
          breakdown.push({
            task: Labels.estimation.optionalReuseIntegration(optionalIntegrations.length),
            hours: optionalIntegrations.length * 1,
            complexity: 'low',
          });
        }
      }

      // ── Data flow implementation ────────────────────────
      if (solution.dataFlows.length > 3) {
        breakdown.push({
          task: Labels.estimation.dataFlowImplementation(solution.dataFlows.length),
          hours: Math.round(solution.dataFlows.length * 0.8 * 10) / 10,
          complexity: solution.dataFlows.length > 6 ? 'high' : 'medium',
        });
      }
    }

    // ── Testing hours — granular by impact ─────────────────
    if (impact) {
      // Unit testing
      const newCount = solution?.proposedComponents.filter((c) => c.isNew).length ?? 0;
      if (newCount > 0) {
        const unitTestHours = newCount * 2;
        breakdown.push({
          task: Labels.estimation.unitTestTask(newCount),
          hours: unitTestHours,
          complexity: newCount > 5 ? 'high' : 'medium',
        });
      }

      // Integration testing
      const integrationCount = solution?.integrations.length ?? 0;
      if (integrationCount > 0) {
        breakdown.push({
          task: Labels.estimation.integrationTestTask(integrationCount),
          hours: Math.max(2, integrationCount * 1.5),
          complexity: 'medium',
        });
      }

      // Regression testing based on impact
      const regressionHours = impact.riskLevel === 'high' ? 8 : impact.riskLevel === 'medium' ? 4 : 2;
      breakdown.push({
        task: Labels.estimation.regressionTest(impact.riskLevel),
        hours: regressionHours,
        complexity: impact.riskLevel,
      });

      // Database migration testing
      if (impact.migrationNotes.length > 0) {
        breakdown.push({
          task: Labels.estimation.dbMigrationTest(impact.migrationNotes.length),
          hours: impact.migrationNotes.length * 3,
          complexity: 'high',
        });
      }

      // Security testing if guards/middleware involved
      const hasSecurityComponents = (solution?.proposedComponents ?? []).some((c) =>
        c.type === 'middleware' || /guard|auth/i.test(c.name),
      );
      if (hasSecurityComponents) {
        breakdown.push({
          task: Labels.estimation.securityTest,
          hours: 4,
          complexity: 'medium',
        });
      }
    }

    // ── Code review & documentation ───────────────────────
    const totalImplHours = breakdown.reduce((sum, item) => sum + item.hours, 0);
    if (totalImplHours > 8) {
      breakdown.push({
        task: Labels.estimation.codeReview,
        hours: Math.round(totalImplHours * 0.1 * 10) / 10,
        complexity: 'low',
      });
    }

    // ── Framework learning curve ──────────────────────────
    if (repo) {
      const unknownFrameworks = repo.frameworks.filter((f) =>
        f.confidence === 'medium' || f.confidence === 'low',
      );
      if (unknownFrameworks.length > 0 && scope?.newModules.length && scope.newModules.length > 0) {
        breakdown.push({
          task: Labels.estimation.frameworkFamiliarization(unknownFrameworks.map((f) => f.name).join(', ')),
          hours: unknownFrameworks.length * 2,
          complexity: 'low',
        });
      }
    }

    // ── Scope-based complexity multiplier ──────────────────
    const complexityMultiplier =
      scope?.estimatedComplexity === 'high' ? 1.2
        : scope?.estimatedComplexity === 'medium' ? 1.1
          : 1.0;

    const totalHours = Math.round(
      breakdown.reduce((sum, item) => sum + item.hours, 0) * complexityMultiplier * 10,
    ) / 10;

    // ── Confidence ────────────────────────────────────────
    // More data sources = higher confidence
    const dataSources = [repo, repoIndex, scope, impact, solution, reuse].filter(Boolean).length;
    const confidence: Estimation['confidence'] =
      dataSources <= 2 || totalHours > 200 ? 'low'
        : dataSources <= 4 || totalHours > 80 ? 'medium'
          : 'high';

    return { totalHours, breakdown, confidence };
  }
}
