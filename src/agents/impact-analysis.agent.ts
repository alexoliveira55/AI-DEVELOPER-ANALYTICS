import { BaseAgent } from '../core';
import { Labels } from '../config';
import {
  AgentRole,
  FeatureContext,
  ImpactAnalysis,
  ImpactedArea,
  SessionContext,
} from '../types';

/**
 * Analyses the impact of the proposed solution on existing code by tracing
 * dependency chains, identifying route conflicts, assessing database schema
 * changes, and computing granular risk based on actual codebase metrics.
 */
export class ImpactAnalysisAgent extends BaseAgent<FeatureContext, ImpactAnalysis> {
  readonly role = AgentRole.ImpactAnalysis;
  readonly name = 'Impact Analyst';

  protected async run(fc: FeatureContext, _context: SessionContext): Promise<ImpactAnalysis> {
    const solution = fc.solutionArchitecture;
    const scope = fc.scopeDefinition;
    const repo = fc.repositoryContext;
    const db = fc.databaseSummary;
    const reuse = fc.reuseAnalysis;

    const existingServices = repo?.services ?? [];
    const existingControllers = repo?.controllers ?? [];
    const existingEndpoints = repo?.apiEndpoints ?? [];
    const existingRepos = repo?.repositories ?? [];
    const existingComponents = repo?.reusableComponents ?? [];
    const totalFiles = repo?.meta.totalFiles ?? 0;
    const totalLines = repo?.meta.totalLines ?? 0;

    const impactedAreas: ImpactedArea[] = [];
    const breakingChanges: string[] = [];
    const testingRecommendations: string[] = [];
    const migrationNotes: string[] = [];

    // ── Modified services — trace dependency chain ─────────
    const modifiedComponents = solution?.proposedComponents.filter((c) => !c.isNew) ?? [];
    for (const comp of modifiedComponents) {
      const svc = existingServices.find((s) => s.name === comp.name);
      if (svc) {
        // Find all consumers of this service (other services that inject it)
        const consumers = existingServices.filter((s) =>
          s.injectedDependencies.includes(svc.name),
        );
        const consumerFiles = consumers.map((c) => c.filePath);
        const allFiles = [svc.filePath, ...consumerFiles];

        const impact: ImpactedArea['impact'] = consumers.length > 2 ? 'high' : consumers.length > 0 ? 'medium' : 'low';
        impactedAreas.push({
          area: comp.name,
          files: allFiles,
          impact,
          description: Labels.impact.serviceModification(svc.filePath, consumers.length, consumers.map((c) => c.name).join(', ')),
        });
        testingRecommendations.push(
          Labels.impact.regressionTests(comp.name, consumers.length, consumers.map((c) => c.name).join(', ')),
        );

        // Check if modified methods are used by consumers
        if (svc.methods.length > 0) {
          breakingChanges.push(
            Labels.impact.verifySignature(comp.name, svc.methods.length, `${svc.methods.slice(0, 5).join(', ')}${svc.methods.length > 5 ? '...' : ''}`),
          );
        }
      }

      // Check if it's a controller
      const ctrl = existingControllers.find((c) => c.name === comp.name);
      if (ctrl) {
        impactedAreas.push({
          area: comp.name,
          files: [ctrl.filePath],
          impact: 'medium',
          description: Labels.impact.controllerModification(ctrl.filePath, ctrl.actions.length),
        });
        testingRecommendations.push(
          Labels.impact.apiContractTests(ctrl.name, ctrl.actions.map((a) => `${a.httpMethod ?? ''} ${a.route ?? a.name}`).join(', ')),
        );
      }

      // Check if it's a repository
      const repoEntry = existingRepos.find((r) => r.name === comp.name);
      if (repoEntry) {
        impactedAreas.push({
          area: comp.name,
          files: [repoEntry.filePath],
          impact: 'medium',
          description: Labels.impact.repoModification(repoEntry.filePath, repoEntry.entity ?? Labels.common.unknown, repoEntry.methods.length),
        });
      }
    }

    // ── New controller routing conflicts ──────────────────
    const newControllers = solution?.proposedComponents.filter((c) => c.isNew && c.type === 'controller') ?? [];
    for (const newCtrl of newControllers) {
      // Extract expected route prefix from description or name
      const ctrlBase = newCtrl.name.replace(/Controller$/i, '').toLowerCase();

      // Check for conflicting routes
      const conflictingEndpoints = existingEndpoints.filter((ep) =>
        ep.route.toLowerCase().includes(ctrlBase),
      );
      if (conflictingEndpoints.length > 0) {
        impactedAreas.push({
          area: Labels.impact.routeConflict(newCtrl.name),
          files: [...new Set(conflictingEndpoints.map((ep) => ep.filePath))],
          impact: 'medium',
          description: Labels.impact.routeConflictDesc(newCtrl.name, conflictingEndpoints.length, conflictingEndpoints.map((ep) => `${ep.method} ${ep.route}`).join(', ')),
        });
        breakingChanges.push(
          Labels.impact.routeConflictBreaking(newCtrl.name, conflictingEndpoints.map((ep) => `${ep.method} ${ep.route}`).join(', ')),
        );
      }

      // Impact on routing configuration
      const affectedCtrlFiles = existingControllers
        .filter((c) => c.name.toLowerCase().includes(ctrlBase) ||
          (scope?.affectedModules ?? []).some((m) =>
            c.name.toLowerCase().includes(m.toLowerCase().replace(/controller$/i, '')),
          ),
        )
        .map((c) => c.filePath);
      if (affectedCtrlFiles.length > 0) {
        impactedAreas.push({
          area: Labels.impact.routingLayer,
          files: affectedCtrlFiles,
          impact: 'low',
          description: Labels.impact.verifyRouting(newControllers.length),
        });
      }
    }

    // ── Database migrations ───────────────────────────────
    const migrations = solution?.proposedComponents.filter((c) => c.type === 'migration') ?? [];
    if (migrations.length > 0) {
      // Check existing DB scripts for related tables
      const relatedScripts = (repo?.databaseScripts ?? []).filter((ds) =>
        migrations.some((m) => ds.tables.some((t) => m.name.toLowerCase().includes(t.toLowerCase()))),
      );

      impactedAreas.push({
        area: Labels.impact.dbSchema,
        files: relatedScripts.map((s) => s.filePath),
        impact: 'high',
        description: Labels.impact.migrationsRequired(migrations.length, migrations.map((m) => m.name).join(', '), relatedScripts.length),
      });

      migrationNotes.push(Labels.impact.runMigrations(migrations.length));
      migrationNotes.push(Labels.impact.createRollback);
      testingRecommendations.push(Labels.impact.verifyMigrationStaging);
      testingRecommendations.push(Labels.impact.validateRollback);

      // Check for foreign key implications from existing tables
      if (db) {
        const existingTableNames = db.tables.map((t) => t.name.toLowerCase());
        for (const migration of migrations) {
          const newTable = migration.name.replace(/^(create-|timestamp-create-)/, '').replace(/-table$/, '');
          const relatedTables = db.tables.filter((t) =>
            t.columns.some((col) => col.name.toLowerCase().includes(newTable)),
          );
          if (relatedTables.length > 0) {
            migrationNotes.push(
              `Table ${newTable} may need foreign keys to: ${relatedTables.map((t) => t.name).join(', ')}`,
            );
          }
        }
      }
    }

    // ── Reusable component impact ─────────────────────────
    const usedComponents = existingComponents.filter((comp) =>
      (solution?.proposedComponents ?? []).some((pc) =>
        pc.dependencies.some((d) => d.toLowerCase().includes(comp.name.toLowerCase())),
      ),
    );
    if (usedComponents.length > 0) {
      impactedAreas.push({
        area: Labels.impact.sharedComponents,
        files: usedComponents.map((c) => c.filePath),
        impact: 'low',
        description: Labels.impact.sharedComponentsDesc(usedComponents.length, usedComponents.map((c) => `${c.name} (${c.category})`).join(', ')),
      });
    }

    // ── Reuse candidates — legacy preservation guard ──────
    if (reuse && reuse.candidates.length > 0) {
      const highReuse = reuse.candidates.filter((c) => c.relevance === 'high');
      for (const candidate of highReuse) {
        // Find how many services consume this candidate
        const svc = existingServices.find((s) => s.name === candidate.name);
        const consumers = svc
          ? existingServices.filter((s) => s.injectedDependencies.includes(svc.name))
          : [];

        // If this candidate is a dependency of proposed components or is being modified
        const isDirectlyUsed = (solution?.proposedComponents ?? []).some(
          (pc) => pc.dependencies.some((d) => d.toLowerCase() === candidate.name.toLowerCase()) ||
                  (pc.name.toLowerCase() === candidate.name.toLowerCase() && !pc.isNew),
        );

        if (isDirectlyUsed) {
          const impact: ImpactedArea['impact'] = consumers.length > 2 ? 'high' : consumers.length > 0 ? 'medium' : 'low';
          impactedAreas.push({
            area: candidate.name,
            files: [candidate.filePath, ...consumers.map((c) => c.filePath)],
            impact,
            description: Labels.impact.highReuseImpact(candidate.name, candidate.filePath, consumers.length),
          });
          if (svc && svc.methods.length > 0) {
            breakingChanges.push(
              Labels.impact.preserveLegacy(candidate.name, svc.methods.slice(0, 5).join(', ')),
            );
          }
          testingRecommendations.push(
            Labels.impact.regressionTests(candidate.name, consumers.length, consumers.map((c) => c.name).join(', ')),
          );
        }
      }
    }

    // ── Integration points impact ─────────────────────────
    const integrationCount = solution?.integrations.length ?? 0;
    if (integrationCount > 3) {
      impactedAreas.push({
        area: Labels.impact.integrationComplexity,
        files: [],
        impact: 'medium',
        description: Labels.impact.integrationComplexityDesc(integrationCount),
      });
      testingRecommendations.push(Labels.impact.integrationTests(integrationCount));
    }

    // ── Breaking changes from modified interfaces ─────────
    if (modifiedComponents.length > 0) {
      breakingChanges.push(
        Labels.impact.modifiedComponentsBreaking(modifiedComponents.length),
      );
    }

    // ── Testing recommendations ───────────────────────────
    const newCount = solution?.proposedComponents.filter((c) => c.isNew).length ?? 0;
    if (newCount > 0) {
      testingRecommendations.push(Labels.impact.unitTests(newCount));
      const dataFlowCount = solution?.dataFlows.length ?? 0;
      if (dataFlowCount > 0) {
        testingRecommendations.push(Labels.impact.dataFlowIntegrationTests(dataFlowCount));
      }
    }

    // Specific testing for middleware/guards
    const newGuards = solution?.proposedComponents.filter((c) => c.type === 'middleware' && c.isNew) ?? [];
    if (newGuards.length > 0) {
      testingRecommendations.push(
        Labels.impact.securityTests(newGuards.length, newGuards.map((g) => g.name).join(', ')),
      );
    }

    testingRecommendations.push(Labels.impact.e2eRegression);

    // ── Risk calculation — multi-factor ───────────────────
    const impactedFileCount = new Set(impactedAreas.flatMap((a) => a.files)).size;
    const impactRatio = impactedFileCount / Math.max(totalFiles, 1);
    const linesRatio = (scope?.inScope.length ?? 0) * 200 / Math.max(totalLines, 1); // rough estimate
    const hasHighImpact = impactedAreas.some((a) => a.impact === 'high');
    const hasMigrations = migrations.length > 0;
    const hasRouteConflicts = impactedAreas.some((a) => a.area.startsWith('Conflito de rota'));
    const highConsumerCount = impactedAreas.some((a) => a.impact === 'high' && a.files.length > 3);

    const riskScore =
      (hasHighImpact ? 3 : 0) +
      (hasMigrations ? 2 : 0) +
      (hasRouteConflicts ? 2 : 0) +
      (highConsumerCount ? 2 : 0) +
      (impactRatio > 0.1 ? 2 : impactRatio > 0.03 ? 1 : 0) +
      (linesRatio > 0.1 ? 1 : 0) +
      (modifiedComponents.length > 3 ? 1 : 0);

    const riskLevel: ImpactAnalysis['riskLevel'] =
      riskScore >= 5 ? 'high' : riskScore >= 2 ? 'medium' : 'low';

    return { impactedAreas, riskLevel, breakingChanges, testingRecommendations, migrationNotes };
  }
}
