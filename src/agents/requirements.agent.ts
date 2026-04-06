import { BaseAgent } from '../core';
import { Labels } from '../config';
import { AgentRole, FeatureContext, Requirement, RequirementsAnalysis, SessionContext } from '../types';
import { RepositoryContext } from '../indexer';
import { DatabaseSummary } from '../database';

/**
 * Parses raw requirement text into structured functional / non-functional
 * requirements. Cross-references the repository context and database schema
 * to infer implied requirements, constraints, and assumptions automatically.
 */
export class RequirementsAgent extends BaseAgent<FeatureContext, RequirementsAnalysis> {
  readonly role = AgentRole.Requirements;
  readonly name = 'Requirements Analyst';

  protected async run(fc: FeatureContext, _context: SessionContext): Promise<RequirementsAnalysis> {
    const rawRequirements = fc.rawRequirements ?? '';
    const repo = fc.repositoryContext;
    const db = fc.databaseSummary;

    const lines = rawRequirements
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const functional: Requirement[] = [];
    const nonFunctional: Requirement[] = [];
    const assumptions: string[] = [];
    const constraints: string[] = [];

    let counter = 1;

    // ── Parse explicit requirements from user text ────────
    for (const line of lines) {
      const cleaned = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
      const lower = cleaned.toLowerCase();

      if (lower.startsWith('assume') || lower.startsWith('assumption')) {
        assumptions.push(cleaned);
        continue;
      }
      if (lower.startsWith('constraint') || lower.startsWith('limitation')) {
        constraints.push(cleaned);
        continue;
      }

      const priority = this.detectPriority(lower);
      const category = this.detectCategory(lower);

      if (this.isNonFunctional(lower)) {
        nonFunctional.push({ id: `NFR-${counter++}`, description: cleaned, priority, category });
      } else {
        functional.push({ id: `FR-${counter++}`, description: cleaned, priority, category });
      }
    }

    // Treat the entire text as a single requirement when nothing was parsed
    if (functional.length === 0 && nonFunctional.length === 0) {
      functional.push({
        id: `FR-${counter++}`,
        description: rawRequirements.trim(),
        priority: 'must',
        category: 'general',
      });
    }

    // ── Infer implied requirements from repository context ─
    if (repo) {
      this.inferFromRepo(repo, rawRequirements, functional, nonFunctional, counter);
      counter += functional.length + nonFunctional.length; // advance counter
    }

    // ── Infer data requirements from database schema ───────
    if (db) {
      this.inferFromDatabase(db, rawRequirements, functional, constraints, counter);
    }

    // ── Derive assumptions from repo structure ─────────────
    if (repo) {
      this.deriveAssumptions(repo, assumptions);
    }

    // ── Derive constraints from repo structure ─────────────
    if (repo) {
      this.deriveConstraints(repo, constraints);
    }

    return { functionalRequirements: functional, nonFunctionalRequirements: nonFunctional, assumptions, constraints };
  }

  // ── Repo-context inference ───────────────────────────────

  private inferFromRepo(
    repo: RepositoryContext,
    raw: string,
    functional: Requirement[],
    nonFunctional: Requirement[],
    startId: number,
  ): void {
    let id = startId;
    const rawLower = raw.toLowerCase();
    const existingDescs = new Set(
      [...functional, ...nonFunctional].map((r) => r.description.toLowerCase()),
    );
    const add = (list: Requirement[], desc: string, priority: Requirement['priority'], category: string) => {
      if (!existingDescs.has(desc.toLowerCase())) {
        list.push({ id: list === functional ? `FR-${id++}` : `NFR-${id++}`, description: desc, priority, category });
        existingDescs.add(desc.toLowerCase());
      }
    };

    // If repo has auth-related services/guards, imply security requirements
    const hasAuth = [
      ...repo.services.map((s) => s.name),
      ...repo.reusableComponents.filter((c) => c.category === 'guard' || c.category === 'middleware').map((c) => c.name),
    ].some((n) => /auth|login|jwt|session|token|permission|role/i.test(n));

    if (hasAuth && /\b(crud|cadastro|register|create|user|usuario|client|cliente|account|conta)\b/i.test(rawLower)) {
      add(nonFunctional, Labels.requirements.enforceAuth, 'must', 'security');
      add(nonFunctional, Labels.requirements.validatePermissions, 'must', 'security');
    }

    // If repo has existing API endpoints, imply API consistency requirements
    if (repo.apiEndpoints.length > 0 && /\b(api|endpoint|rest|crud|cadastro|register)\b/i.test(rawLower)) {
      const methods = [...new Set(repo.apiEndpoints.map((e) => e.method))];
      add(functional,
        Labels.requirements.exposeEndpoints(methods.join(', ')),
        'must', 'api');
    }

    // If repo has validation middleware/pipes, imply validation requirements
    const hasValidation = repo.reusableComponents.some((c) =>
      /valid|pipe|schema|dto/i.test(c.name),
    );
    if (hasValidation) {
      add(nonFunctional, Labels.requirements.applyValidation, 'must', 'security');
    }

    // If repo has existing repositories/data layers, imply data persistence
    if (repo.repositories.length > 0 && /\b(crud|cadastro|create|save|store|persist|register)\b/i.test(rawLower)) {
      add(functional,
        Labels.requirements.implementPersistence(repo.repositories.length),
        'must', 'data');
    }

    // If repo has existing error handling middleware, imply error handling
    const hasErrorHandling = repo.reusableComponents.some((c) =>
      /error|exception|filter/i.test(c.name),
    );
    if (hasErrorHandling) {
      add(nonFunctional, Labels.requirements.followErrorHandling, 'should', 'api');
    }

    // Logging/monitoring if already present
    const hasLogging = repo.reusableComponents.some((c) =>
      /log|monitor|interceptor/i.test(c.name),
    );
    if (hasLogging) {
      add(nonFunctional, Labels.requirements.integrateLogging, 'should', 'infrastructure');
    }
  }

  // ── Database-context inference ───────────────────────────

  private inferFromDatabase(
    db: DatabaseSummary,
    raw: string,
    functional: Requirement[],
    constraints: string[],
    startId: number,
  ): void {
    let id = startId;
    const rawLower = raw.toLowerCase();
    const existingDescs = new Set(functional.map((r) => r.description.toLowerCase()));

    // Identify tables that relate to the feature
    const featureKeywords = rawLower.match(/\b[a-z]{3,}\b/g) ?? [];
    const relatedTables = db.tables.filter((t) =>
      featureKeywords.some((k) => t.name.toLowerCase().includes(k)),
    );

    if (relatedTables.length > 0) {
      const tableNames = relatedTables.map((t) => t.name).join(', ');
      const desc = Labels.requirements.integrateDbTables(tableNames);
      if (!existingDescs.has(desc.toLowerCase())) {
        functional.push({ id: `FR-${id++}`, description: desc, priority: 'must', category: 'data' });
      }

      // Add column-level constraints for related tables
      for (const table of relatedTables) {
        const pkColNames = new Set(table.primaryKey?.columns ?? []);
        const notNullCols = table.columns.filter((c) => !c.nullable && !pkColNames.has(c.name));
        if (notNullCols.length > 0) {
          constraints.push(
            Labels.requirements.tableRequiredFields(table.name, notNullCols.map((c) => c.name).join(', ')),
          );
        }
      }
    }

    // If DB has stored procedures, note integration constraint
    if (db.storedProcedures && db.storedProcedures.length > 0) {
      const relevantProcs = db.storedProcedures.filter((sp) =>
        featureKeywords.some((k) => sp.name.toLowerCase().includes(k)),
      );
      if (relevantProcs.length > 0) {
        constraints.push(
          Labels.requirements.storedProcUpdates(relevantProcs.map((sp) => sp.name).join(', ')),
        );
      }
    }
  }

  // ── Assumption derivation ────────────────────────────────

  private deriveAssumptions(repo: RepositoryContext, assumptions: string[]): void {
    const existing = new Set(assumptions.map((a) => a.toLowerCase()));
    const add = (text: string) => {
      if (!existing.has(text.toLowerCase())) {
        assumptions.push(text);
        existing.add(text.toLowerCase());
      }
    };

    add(Labels.requirements.repoFollows(repo.architecturePattern.primary));

    if (repo.frameworks.length > 0) {
      const primary = repo.frameworks.filter((f) => f.confidence === 'high').map((f) => f.name);
      if (primary.length > 0) {
        add(Labels.requirements.frameworkStack(primary.join(', ')));
      }
    }

    const primaryLang = repo.languages.sort((a, b) => b.lines - a.lines)[0];
    if (primaryLang) {
      add(Labels.requirements.primaryLanguage(primaryLang.language, primaryLang.percentage.toFixed(1)));
    }
  }

  // ── Constraint derivation ────────────────────────────────

  private deriveConstraints(repo: RepositoryContext, constraints: string[]): void {
    const existing = new Set(constraints.map((c) => c.toLowerCase()));
    const add = (text: string) => {
      if (!existing.has(text.toLowerCase())) {
        constraints.push(text);
        existing.add(text.toLowerCase());
      }
    };

    // Architecture constraint
    if (repo.architecturePattern.patterns.length > 0) {
      add(Labels.requirements.mustFollowPatterns(repo.architecturePattern.patterns.join(', ')));
    }

    // If there are existing API naming conventions, impose them
    if (repo.apiEndpoints.length > 0) {
      const routes = repo.apiEndpoints.map((e) => e.route);
      const prefixes = [...new Set(routes.map((r) => r.split('/').filter(Boolean)[0]).filter(Boolean))];
      if (prefixes.length > 0 && prefixes.length <= 10) {
        add(Labels.requirements.apiRouteConvention(`/${prefixes.join(', /')}`));
      }
    }

    // Dependency injection constraint
    const hasDI = repo.services.some((s) => s.injectedDependencies.length > 0);
    if (hasDI) {
      add(Labels.requirements.mustUseDI);
    }
  }

  // ── Detection helpers ────────────────────────────────────

  private detectPriority(text: string): 'must' | 'should' | 'could' {
    if (/\b(must|critical|required|essential|obrigat[oó]ri|precis[ao])\b/.test(text)) return 'must';
    if (/\b(could|nice to have|optional|desej[aá]vel|poderia)\b/.test(text)) return 'could';
    return 'should';
  }

  private detectCategory(text: string): string {
    if (/\b(api|endpoint|rest|graphql|rota|route)\b/.test(text)) return 'api';
    if (/\b(ui|interface|frontend|page|screen|form|tela|formul[aá]rio|p[aá]gina)\b/.test(text)) return 'ui';
    if (/\b(database|table|column|migration|schema|banco|tabela|coluna|dado)\b/.test(text)) return 'data';
    if (/\b(auth|login|permission|role|security|autentica|permiss|seguran)/i.test(text)) return 'security';
    if (/\b(test|spec|coverage|teste)\b/.test(text)) return 'testing';
    if (/\b(deploy|ci|cd|pipeline|docker|infra)\b/.test(text)) return 'infrastructure';
    if (/\b(notification|email|sms|webhook|notifica)/i.test(text)) return 'integration';
    if (/\b(crud|cadastr|register|registr|creat|criar|list|listar|edit|editar|delet|exclu|remov)/i.test(text)) return 'data';
    return 'general';
  }

  private isNonFunctional(text: string): boolean {
    return /\b(performance|scalab|secur|reliab|availab|maintain|monitor|log|compliance|audit|desempenho|escala|confiab|disponib)/i.test(text);
  }
}
