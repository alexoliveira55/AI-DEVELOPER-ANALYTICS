import { BaseAgent } from '../core';
import { Labels } from '../config';
import { AgentRole, FeatureContext, ScopeDefinition, ScopeItem, SessionContext } from '../types';

/**
 * Determines the scope of work by cross-referencing requirements against the
 * full repository context: services, controllers, repositories, endpoints,
 * database scripts, reusable components, and architecture patterns.
 */
export class ScopeAgent extends BaseAgent<FeatureContext, ScopeDefinition> {
  readonly role = AgentRole.Scope;
  readonly name = 'Scope Analyst';

  protected async run(fc: FeatureContext, _context: SessionContext): Promise<ScopeDefinition> {
    const requirements = fc.requirementsAnalysis!;
    const repo = fc.repositoryContext;
    const db = fc.databaseSummary;

    const allRequirements = [
      ...requirements.functionalRequirements,
      ...requirements.nonFunctionalRequirements,
    ];
    const reqTexts = allRequirements.map((r) => r.description.toLowerCase());
    const reqKeywords = this.extractKeywords(reqTexts);

    const inScope: ScopeItem[] = [];
    const outOfScope: string[] = [];
    const affectedModules: string[] = [];
    const newModules: string[] = [];

    // ── Match existing services ───────────────────────────
    for (const service of repo?.services ?? []) {
      const nameLower = service.name.toLowerCase().replace(/service$/i, '');
      if (this.matchesKeywords(nameLower, reqKeywords) || reqTexts.some((t) => t.includes(nameLower))) {
        affectedModules.push(service.name);
        const relevantMethods = service.methods.filter((m) =>
          reqKeywords.some((k) => m.toLowerCase().includes(k)),
        );
        const methodHint = relevantMethods.length > 0
          ? Labels.scope.methodsToReview(relevantMethods.join(', '))
          : '';
        inScope.push({
          area: service.name,
          description: Labels.scope.modifyService(service.filePath, methodHint),
          type: 'modification',
        });

        // Also flag dependencies that may need updates
        for (const dep of service.injectedDependencies) {
          if (!affectedModules.includes(dep)) {
            affectedModules.push(dep);
          }
        }
      }
    }

    // ── Match existing controllers ────────────────────────
    for (const ctrl of repo?.controllers ?? []) {
      const nameLower = ctrl.name.toLowerCase().replace(/controller$/i, '');
      if (this.matchesKeywords(nameLower, reqKeywords) || reqTexts.some((t) => t.includes(nameLower))) {
        if (!affectedModules.includes(ctrl.name)) affectedModules.push(ctrl.name);
        const affectedActions = ctrl.actions.filter((a) =>
          reqKeywords.some((k) => a.name.toLowerCase().includes(k)),
        );
        const actionHint = affectedActions.length > 0
          ? Labels.scope.actionsHint(affectedActions.map((a) => `${a.httpMethod ?? 'ANY'} ${a.route ?? a.name}`).join(', '))
          : '';
        inScope.push({
          area: ctrl.name,
          description: Labels.scope.modifyController(ctrl.filePath, actionHint),
          type: 'modification',
        });
      }
    }

    // ── Match existing repositories ───────────────────────
    for (const repoEntry of repo?.repositories ?? []) {
      const nameLower = repoEntry.name.toLowerCase().replace(/repository$/i, '');
      if (this.matchesKeywords(nameLower, reqKeywords) || reqTexts.some((t) => t.includes(nameLower))) {
        if (!affectedModules.includes(repoEntry.name)) affectedModules.push(repoEntry.name);
        inScope.push({
          area: repoEntry.name,
          description: Labels.scope.extendDataAccess(repoEntry.filePath, repoEntry.entity ?? Labels.common.unknown),
          type: 'modification',
        });
      }
    }

    // ── Match affected API endpoints ──────────────────────
    const affectedEndpoints = (repo?.apiEndpoints ?? []).filter((ep) => {
      const routeLower = ep.route.toLowerCase();
      return reqKeywords.some((k) => routeLower.includes(k));
    });
    if (affectedEndpoints.length > 0) {
      const routes = affectedEndpoints.map((ep) => `${ep.method} ${ep.route}`);
      inScope.push({
        area: 'api-endpoints',
        description: Labels.scope.reviewEndpoints(affectedEndpoints.length, routes.join(', ')),
        type: 'modification',
      });
    }

    // ── Match database scripts ────────────────────────────
    const affectedDbScripts = (repo?.databaseScripts ?? []).filter((ds) =>
      ds.tables.some((t) => reqKeywords.some((k) => t.toLowerCase().includes(k))),
    );
    if (affectedDbScripts.length > 0) {
      for (const script of affectedDbScripts) {
        inScope.push({
          area: `db-${script.type}`,
          description: Labels.scope.reviewDbScript(script.type, script.filePath, script.tables.join(', ')),
          type: 'modification',
        });
      }
    }

    // ── Database table impacts ────────────────────────────
    if (db) {
      const affectedTables = db.tables.filter((t) =>
        reqKeywords.some((k) => t.name.toLowerCase().includes(k)),
      );
      if (affectedTables.length > 0) {
        for (const table of affectedTables) {
          const colCount = table.columns.length;
          const pkCols = table.primaryKey?.columns ?? [];
          inScope.push({
            area: `table:${table.name}`,
            description: Labels.scope.integrateTable(table.name, colCount, pkCols.join(', ')),
            type: 'integration',
          });
        }
      }

      // New tables needed
      const existingTableNames = db.tables.map((t) => t.name.toLowerCase());
      const categories = new Set(allRequirements.map((r) => r.category));
      if (categories.has('data')) {
        const needsNewTable = reqKeywords.some((k) =>
          !existingTableNames.some((t) => t.includes(k)) &&
          /crud|cadastr|create|register|entit/i.test(allRequirements.map((r) => r.description).join(' ')),
        );
        if (needsNewTable) {
          inScope.push({
            area: 'database-migration',
            description: Labels.scope.newMigrationRequired,
            type: 'new',
          });
          newModules.push(Labels.scope.databaseMigration);
        }
      }
    }

    // ── Identify new modules by requirement category ──────
    const categories = new Set(allRequirements.map((r) => r.category));
    for (const category of categories) {
      if (category === 'general') continue;
      const alreadyCovered =
        (repo?.services ?? []).some((s) => s.name.toLowerCase().includes(category)) ||
        (repo?.controllers ?? []).some((c) => c.name.toLowerCase().includes(category)) ||
        affectedModules.some((m) => m.toLowerCase().includes(category));
      if (!alreadyCovered) {
        const moduleName = `${category}-module`;
        if (!newModules.includes(moduleName)) {
          newModules.push(moduleName);
          inScope.push({
            area: moduleName,
            description: Labels.scope.newModuleFor(category),
            type: 'new',
          });
        }
      }
    }

    // ── API integration scope ─────────────────────────────
    if (categories.has('api') || categories.has('integration')) {
      if (!inScope.some((s) => s.area === 'api-integration')) {
        inScope.push({
          area: 'api-integration',
          description: Labels.scope.apiIntegration,
          type: 'integration',
        });
      }
    }

    // ── Functional requirements as scope items ─────────────
    for (const req of requirements.functionalRequirements) {
      if (!inScope.some((s) => s.description.includes(req.description.substring(0, 30)))) {
        inScope.push({ area: req.category, description: req.description, type: 'new' });
      }
    }

    // ── Out of scope: non-functional "could" items ─────────
    for (const nfr of requirements.nonFunctionalRequirements) {
      if (nfr.priority === 'could') {
        outOfScope.push(nfr.description);
      }
    }

    // ── Complexity calculation ─────────────────────────────
    const totalItems = inScope.length + newModules.length;
    const hasDbChanges = inScope.some((s) => s.area.startsWith('table:') || s.area.startsWith('db-') || s.area === 'database-migration');
    const hasMultipleModifications = inScope.filter((s) => s.type === 'modification').length > 3;

    const estimatedComplexity: ScopeDefinition['estimatedComplexity'] =
      totalItems > 10 || (hasDbChanges && hasMultipleModifications)
        ? 'high'
        : totalItems > 4 || hasDbChanges
          ? 'medium'
          : 'low';

    return { inScope, outOfScope, affectedModules, newModules, estimatedComplexity };
  }

  private extractKeywords(texts: string[]): string[] {
    const stopWords = new Set([
      'the','a','an','is','are','was','were','be','been','being',
      'have','has','had','do','does','did','will','would','shall',
      'should','may','might','can','could','must','need','to','of',
      'in','for','on','with','at','by','from','as','into','through',
      'that','this','and','but','or','not','so','if','when','new',
      'existing','module','using','follow','apply','implement',
      'integrate','enforce','validate','review','modify','create',
    ]);
    const words = texts.join(' ').match(/\b[a-z]{3,}\b/g) ?? [];
    return [...new Set(words.filter((w) => !stopWords.has(w)))];
  }

  private matchesKeywords(name: string, keywords: string[]): boolean {
    return keywords.some((k) => name.includes(k) || k.includes(name));
  }
}
