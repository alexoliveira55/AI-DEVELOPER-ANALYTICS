import { BaseAgent } from '../core';
import { Labels } from '../config';
import {
  AgentRole,
  DataFlow,
  FeatureContext,
  Integration,
  ProposedComponent,
  RequirementsAnalysis,
  ReuseAnalysis,
  ScopeDefinition,
  SessionContext,
  SolutionArchitecture,
} from '../types';

/**
 * Proposes an architectural solution grounded in the repository's actual
 * structure, frameworks, naming conventions, and existing components.
 * Generates components, integrations, and data flows that align with the
 * detected architecture pattern and existing patterns in the codebase.
 */
export class SolutionArchitectAgent extends BaseAgent<FeatureContext, SolutionArchitecture> {
  readonly role = AgentRole.SolutionArchitect;
  readonly name = 'Solution Architect';

  protected async run(
    fc: FeatureContext,
    _context: SessionContext,
  ): Promise<SolutionArchitecture> {
    const requirements = fc.requirementsAnalysis!;
    const scope = fc.scopeDefinition!;
    const reuse = fc.reuseAnalysis!;
    const repo = fc.repositoryContext;
    const db = fc.databaseSummary;

    const currentArchitecture = repo?.architecturePattern.primary ?? 'Unknown';
    const archPatterns = repo?.architecturePattern.patterns ?? [];
    const frameworks = repo?.frameworks ?? [];
    const existingServices = repo?.services ?? [];
    const existingControllers = repo?.controllers ?? [];
    const existingRepos = repo?.repositories ?? [];
    const existingEndpoints = repo?.apiEndpoints ?? [];
    const existingTables = db?.tables ?? [];

    const proposedComponents: ProposedComponent[] = [];
    const integrations: Integration[] = [];
    const dataFlows: DataFlow[] = [];

    // Detect naming conventions from existing code
    const namingConvention = this.detectNamingConvention(existingServices.map((s) => s.name));
    const routePrefix = this.detectRoutePrefix(existingEndpoints.map((e) => e.route));

    // ── New components for each new module ─────────────────
    for (const mod of scope.newModules) {
      const moduleName = mod.replace(/-module$/, '');
      const pascal = this.pascalCase(moduleName);

      // Service — with inferred dependencies from reuse + existing services
      const serviceDeps = this.inferServiceDependencies(reuse, existingServices, moduleName);
      proposedComponents.push({
        name: this.applyNamingConvention(`${pascal}Service`, namingConvention),
        type: 'service',
        description: Labels.solution.coreBusinessLogic(moduleName),
        isNew: true,
        dependencies: serviceDeps,
      });

      // Controller — with specific endpoint descriptions
      if (this.needsController(requirements, moduleName)) {
        const controllerName = this.applyNamingConvention(`${pascal}Controller`, namingConvention);
        const serviceRef = this.applyNamingConvention(`${pascal}Service`, namingConvention);
        proposedComponents.push({
          name: controllerName,
          type: 'controller',
          description: Labels.solution.restController(moduleName, routePrefix),
          isNew: true,
          dependencies: [serviceRef],
        });
      }

      // Data layer — repository + model + migration
      if (this.needsDataLayer(requirements, moduleName, existingTables.map((t) => t.name))) {
        const repoName = this.applyNamingConvention(`${pascal}Repository`, namingConvention);
        proposedComponents.push({
          name: repoName,
          type: 'repository',
          description: Labels.solution.dataAccessLayer(moduleName,
            archPatterns.includes('Repository Pattern') ? Labels.solution.repositoryPattern : Labels.solution.dataAccess),
          isNew: true,
          dependencies: [],
        });

        // Model — with column hints from related DB tables
        const relatedTable = existingTables.find((t) => t.name.toLowerCase().includes(moduleName));
        const columnHint = relatedTable
          ? Labels.solution.reference(relatedTable.name, relatedTable.columns.length)
          : '';
        proposedComponents.push({
          name: pascal,
          type: 'model',
          description: Labels.solution.domainEntity(moduleName, columnHint),
          isNew: true,
          dependencies: [],
        });

        // Migration only if no matching table exists
        if (!existingTables.some((t) => t.name.toLowerCase().includes(moduleName))) {
          const existingMigrationPattern = this.detectMigrationNamingPattern(
            repo?.databaseScripts ?? [],
          );
          proposedComponents.push({
            name: existingMigrationPattern
              ? `${existingMigrationPattern}-create-${moduleName}`
              : `create-${moduleName}-table`,
            type: 'migration',
            description: Labels.solution.dbMigration(moduleName),
            isNew: true,
            dependencies: [],
          });
        }
      }

      // Middleware — if security requirements exist
      if (this.needsMiddleware(requirements, moduleName)) {
        proposedComponents.push({
          name: this.applyNamingConvention(`${pascal}Guard`, namingConvention),
          type: 'middleware',
          description: Labels.solution.authGuard(moduleName),
          isNew: true,
          dependencies: [],
        });
      }

      // DTO / Validation — if the framework supports it
      const hasValidationFramework = frameworks.some((f) =>
        /class-validator|joi|zod|yup/i.test(f.name),
      );
      if (hasValidationFramework) {
        proposedComponents.push({
          name: `Create${pascal}Dto`,
          type: 'utility',
          description: Labels.solution.createDto(moduleName),
          isNew: true,
          dependencies: [],
        });
        proposedComponents.push({
          name: `Update${pascal}Dto`,
          type: 'utility',
          description: Labels.solution.updateDto(moduleName),
          isNew: true,
          dependencies: [],
        });
      }
    }

    // ── Modifications for affected modules ─────────────────
    for (const mod of scope.affectedModules) {
      const existing = existingServices.find((s) => s.name === mod);
      const existingCtrl = existingControllers.find((c) => c.name === mod);
      const existingRepo = existingRepos.find((r) => r.name === mod);

      if (existing) {
        proposedComponents.push({
          name: mod,
          type: 'service',
          description: Labels.solution.extendService(mod, existing.filePath, existing.methods.length),
          isNew: false,
          dependencies: existing.injectedDependencies,
        });
      } else if (existingCtrl) {
        proposedComponents.push({
          name: mod,
          type: 'controller',
          description: Labels.solution.extendController(mod, existingCtrl.filePath, existingCtrl.actions.length),
          isNew: false,
          dependencies: [],
        });
      } else if (existingRepo) {
        proposedComponents.push({
          name: mod,
          type: 'repository',
          description: Labels.solution.extendRepository(mod, existingRepo.filePath, existingRepo.entity ?? Labels.common.unknown),
          isNew: false,
          dependencies: [],
        });
      } else {
        proposedComponents.push({
          name: mod,
          type: 'service',
          description: Labels.solution.extendExisting(mod),
          isNew: false,
          dependencies: [],
        });
      }
    }

    // ── Integrations ──────────────────────────────────────
    // New services → high-relevance reuse candidates
    for (const newComp of proposedComponents.filter((c) => c.isNew && c.type === 'service')) {
      for (const candidate of reuse.candidates.filter((c) => c.relevance === 'high')) {
        integrations.push({
          source: newComp.name,
          target: candidate.name,
          type: 'dependency',
          description: Labels.solution.reusesComponent(newComp.name, candidate.name, candidate.type, candidate.filePath),
        });
      }
    }

    // New services → existing modified services (cross-service calls)
    for (const newComp of proposedComponents.filter((c) => c.isNew && c.type === 'service')) {
      for (const modComp of proposedComponents.filter((c) => !c.isNew && c.type === 'service')) {
        if (newComp.dependencies.includes(modComp.name)) {
          integrations.push({
            source: newComp.name,
            target: modComp.name,
            type: 'cross-service',
            description: Labels.solution.dependsOnExisting(newComp.name, modComp.name),
          });
        }
      }
    }

    // Medium-relevance candidates as optional integrations
    for (const candidate of reuse.candidates.filter((c) => c.relevance === 'medium' && c.type !== 'controller')) {
      const newServices = proposedComponents.filter((c) => c.isNew && c.type === 'service');
      if (newServices.length > 0) {
        integrations.push({
          source: newServices[0].name,
          target: candidate.name,
          type: 'optional',
          description: Labels.solution.considerReuse(candidate.name, candidate.type),
        });
      }
    }

    // ── Data flows — detailed request/response chain ──────
    const newControllers = proposedComponents.filter((c) => c.type === 'controller' && c.isNew);
    const newRepos = proposedComponents.filter((c) => c.type === 'repository' && c.isNew);

    for (const ctrl of newControllers) {
      const svcName = ctrl.dependencies[0];
      if (svcName) {
        const moduleName = ctrl.name.replace(/Controller$/i, '');
        dataFlows.push({
          from: Labels.solution.client,
          to: ctrl.name,
          data: Labels.solution.httpRequest(routePrefix, moduleName.toLowerCase()),
          description: Labels.solution.incomingRequest,
        });
        dataFlows.push({
          from: ctrl.name,
          to: svcName,
          data: Labels.solution.validatedDto(moduleName),
          description: Labels.solution.dtoToService,
        });
      }
    }

    for (const svc of proposedComponents.filter((c) => c.type === 'service' && c.isNew)) {
      const svcBase = svc.name.replace(/Service$/i, '');
      const matchingRepo = newRepos.find(
        (r) => r.name.replace(/Repository$/i, '') === svcBase,
      );
      if (matchingRepo) {
        dataFlows.push({
          from: svc.name,
          to: matchingRepo.name,
          data: Labels.solution.entityLabel(svcBase),
          description: Labels.solution.serviceToPersistence,
        });
        dataFlows.push({
          from: matchingRepo.name,
          to: Labels.solution.database,
          data: Labels.solution.sqlOrmQuery,
          description: Labels.solution.repoToDb,
        });
      }
    }

    // Response flow back
    if (newControllers.length > 0) {
      dataFlows.push({
        from: newControllers[0].name,
        to: Labels.solution.client,
        data: Labels.solution.jsonResponse,
        description: Labels.solution.serializedResponse,
      });
    }

    // ── Technology Stack ──────────────────────────────────
    const technologyStack = [
      ...new Set([
        ...frameworks.filter((f) => f.confidence === 'high').map((f) => `${f.name}${f.version ? ` ${f.version}` : ''}`),
        ...frameworks.filter((f) => f.confidence === 'medium').map((f) => f.name),
      ]),
    ];

    // Add language info
    if (repo) {
      const primaryLang = repo.languages.sort((a, b) => b.lines - a.lines)[0];
      if (primaryLang && !technologyStack.some((t) => t.toLowerCase().includes(primaryLang.language.toLowerCase()))) {
        technologyStack.unshift(primaryLang.language);
      }
    }

    // ── Overview ──────────────────────────────────────────
    const newCount = proposedComponents.filter((c) => c.isNew).length;
    const modCount = proposedComponents.filter((c) => !c.isNew).length;
    const integrationCount = integrations.length;

    const overview = Labels.solution.overviewText(
      newCount, modCount, currentArchitecture,
      archPatterns.length > 0 ? ` (padrões: ${archPatterns.join(', ')})` : '',
      integrationCount,
      technologyStack.slice(0, 5).join(', '),
      scope.estimatedComplexity,
    );

    return { overview, proposedComponents, integrations, dataFlows, technologyStack };
  }

  private needsController(req: RequirementsAnalysis, module: string): boolean {
    const all = [...req.functionalRequirements, ...req.nonFunctionalRequirements];
    return all.some(
      (r) =>
        r.category === 'api' ||
        r.category === 'data' || // CRUD features need endpoints
        /\b(endpoint|api|route|crud|cadastr|register|list|creat|rota)\b/i.test(r.description) ||
        r.description.toLowerCase().includes(module),
    );
  }

  private needsDataLayer(
    req: RequirementsAnalysis,
    module: string,
    tables: string[],
  ): boolean {
    const all = [...req.functionalRequirements, ...req.nonFunctionalRequirements];
    const hasDataReq = all.some((r) =>
      r.category === 'data' ||
      /\b(database|store|persist|table|save|create|crud|cadastr|register|entity|entidade)\b/i.test(r.description),
    );
    return hasDataReq || tables.some((t) => t.toLowerCase().includes(module));
  }

  private needsMiddleware(req: RequirementsAnalysis, _module: string): boolean {
    return req.nonFunctionalRequirements.some((r) =>
      r.category === 'security' || /\b(auth|permission|role|guard|protect)\b/i.test(r.description),
    );
  }

  private inferServiceDependencies(
    reuse: ReuseAnalysis,
    existingServices: { name: string; methods: string[] }[],
    moduleName: string,
  ): string[] {
    const deps: string[] = [];

    // High-relevance reuse candidates
    for (const c of reuse.candidates.filter((c) => c.relevance === 'high')) {
      deps.push(c.name);
    }

    // Existing services that are likely needed
    for (const svc of existingServices) {
      const svcBase = svc.name.toLowerCase().replace(/service$/i, '');
      if (moduleName.includes(svcBase) || svcBase.includes(moduleName)) {
        if (!deps.includes(svc.name)) deps.push(svc.name);
      }
    }

    return deps;
  }

  private detectNamingConvention(serviceNames: string[]): 'camelCase' | 'PascalCase' | 'kebab-case' {
    if (serviceNames.length === 0) return 'PascalCase';
    const first = serviceNames[0];
    if (first.includes('-')) return 'kebab-case';
    if (first[0] === first[0].toLowerCase()) return 'camelCase';
    return 'PascalCase';
  }

  private applyNamingConvention(name: string, convention: string): string {
    if (convention === 'PascalCase') return name;
    if (convention === 'camelCase') return name[0].toLowerCase() + name.slice(1);
    return name; // keep as-is for other conventions
  }

  private detectRoutePrefix(routes: string[]): string {
    if (routes.length === 0) return '/api';
    const prefixes = routes.map((r) => '/' + r.split('/').filter(Boolean)[0]).filter(Boolean);
    const freq = new Map<string, number>();
    for (const p of prefixes) freq.set(p, (freq.get(p) ?? 0) + 1);
    let best = '/api';
    let bestCount = 0;
    for (const [p, c] of freq) {
      if (c > bestCount) { best = p; bestCount = c; }
    }
    return best;
  }

  private detectMigrationNamingPattern(scripts: { filePath: string; type: string }[]): string | null {
    const migrations = scripts.filter((s) => s.type === 'migration');
    if (migrations.length === 0) return null;
    // Try to detect timestamp-based naming
    const match = migrations[0].filePath.match(/(\d{14}|\d{13}|\d{10})/);
    return match ? 'timestamp' : null;
  }

  private pascalCase(str: string): string {
    return str.replace(/(^|[-_])(\w)/g, (_, _sep, char: string) => char.toUpperCase());
  }
}
