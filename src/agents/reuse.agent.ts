import { BaseAgent } from '../core';
import { Labels } from '../config';
import { AgentRole, FeatureContext, RequirementsAnalysis, ReuseAnalysis, ReuseCandidate, SessionContext } from '../types';

/**
 * Identifies existing code that can be reused to fulfil requirements.
 * Scans services, repositories, reusable components, controllers, endpoints,
 * and database scripts for relevance — producing specific, actionable reasons
 * with file paths, method names, and integration guidance.
 */
export class ReuseAgent extends BaseAgent<FeatureContext, ReuseAnalysis> {
  readonly role = AgentRole.Reuse;
  readonly name = 'Reuse Analyst';

  protected async run(fc: FeatureContext, _context: SessionContext): Promise<ReuseAnalysis> {
    const requirements = fc.requirementsAnalysis;
    const repo = fc.repositoryContext;
    const scope = fc.scopeDefinition;

    const candidates: ReuseCandidate[] = [];
    const keywords = requirements ? this.extractKeywords(requirements) : [];

    // Also pull keywords from scope's affected modules
    if (scope) {
      for (const mod of scope.affectedModules) {
        const modKeyword = mod.toLowerCase().replace(/service|controller|repository$/gi, '').trim();
        if (modKeyword.length >= 3 && !keywords.includes(modKeyword)) {
          keywords.push(modKeyword);
        }
      }
    }

    if (!repo) {
      return {
        candidates: [],
        summary: Labels.reuse.noRepoContext,
        reuseScore: 0,
      };
    }

    // ── Reusable components (utilities, helpers, middleware, etc.) ─
    for (const comp of repo.reusableComponents) {
      const relevance = this.computeRelevance(comp.name, comp.exports, keywords);
      if (relevance) {
        const matchedExports = comp.exports.filter((e) =>
          keywords.some((k) => e.toLowerCase().includes(k)),
        );
        const exportHint = matchedExports.length > 0
          ? Labels.reuse.exportsHint(matchedExports.join(', '))
          : '';
        candidates.push({
          name: comp.name,
          filePath: comp.filePath,
          type: comp.category,
          relevance,
          reason: Labels.reuse.existingComponent(comp.category, comp.filePath, exportHint),
        });
      }
    }

    // ── Services — with method-level detail ───────────────
    for (const svc of repo.services) {
      const relevance = this.computeRelevance(svc.name, svc.methods, keywords);
      if (relevance) {
        const matchedMethods = svc.methods.filter((m) =>
          keywords.some((k) => m.toLowerCase().includes(k)),
        );
        const deps = svc.injectedDependencies;
        const depHint = deps.length > 0 ? ` | deps: ${deps.join(', ')}` : '';
        candidates.push({
          name: svc.name,
          filePath: svc.filePath,
          type: 'service',
          relevance,
          reason: matchedMethods.length > 0
            ? Labels.reuse.reuseMethods(matchedMethods.join(', '), svc.filePath, depHint)
            : Labels.reuse.serviceMatchesDomain(svc.name, depHint),
        });
      }
    }

    // ── Repositories — with entity awareness ──────────────
    for (const repoEntry of repo.repositories) {
      const relevance = this.computeRelevance(repoEntry.name, repoEntry.methods, keywords);
      if (relevance) {
        const matchedMethods = repoEntry.methods.filter((m) =>
          keywords.some((k) => m.toLowerCase().includes(k)),
        );
        const entityHint = repoEntry.entity ? ` (entity: ${repoEntry.entity})` : '';
        candidates.push({
          name: repoEntry.name,
          filePath: repoEntry.filePath,
          type: 'repository',
          relevance,
          reason: matchedMethods.length > 0
            ? Labels.reuse.reuseDataAccess(matchedMethods.join(', '), entityHint)
            : Labels.reuse.repoMatchesDomain(entityHint),
        });
      }
    }

    // ── Controllers — reuse existing endpoint patterns ────
    for (const ctrl of repo.controllers) {
      const nameLower = ctrl.name.toLowerCase().replace(/controller$/i, '');
      const nameMatch = keywords.some((k) => nameLower.includes(k));
      const actionMatches = ctrl.actions.filter((a) =>
        keywords.some((k) => a.name.toLowerCase().includes(k)),
      );
      if (nameMatch || actionMatches.length > 0) {
        const relevance = nameMatch && actionMatches.length >= 2 ? 'high'
          : nameMatch || actionMatches.length >= 1 ? 'medium' : 'low';
        const basePath = ctrl.basePath ? ` (base: ${ctrl.basePath})` : '';
        candidates.push({
          name: ctrl.name,
          filePath: ctrl.filePath,
          type: 'controller',
          relevance,
          reason: actionMatches.length > 0
            ? Labels.reuse.reuseEndpointPatterns(actionMatches.map((a) => `${a.httpMethod ?? 'ANY'} ${a.route ?? a.name}`).join(', '), basePath)
            : Labels.reuse.controllerSameDomain(basePath),
        });
      }
    }

    // ── API endpoints — reuse route patterns where new endpoints are similar ─
    const endpointPatterns = this.detectEndpointPatterns(repo.apiEndpoints.map((e) => ({
      method: e.method, route: e.route, filePath: e.filePath,
    })));
    if (endpointPatterns.length > 0 && requirements) {
      const hasApiReq = requirements.functionalRequirements.some((r) =>
        r.category === 'api' || /endpoint|api|route/i.test(r.description),
      );
      if (hasApiReq) {
        candidates.push({
          name: 'API Route Conventions',
          filePath: endpointPatterns[0].filePath,
          type: 'utility',
          relevance: 'medium',
          reason: Labels.reuse.followRoutePatterns(endpointPatterns.map((p) => `${p.method} ${p.pattern}`).join(', ')),
        });
      }
    }

    // ── Database scripts — reuse migration patterns ───────
    const relevantDbScripts = repo.databaseScripts.filter((ds) =>
      ds.tables.some((t) => keywords.some((k) => t.toLowerCase().includes(k))),
    );
    for (const ds of relevantDbScripts) {
      candidates.push({
        name: `${ds.type}:${ds.tables.join(',')}`,
        filePath: ds.filePath,
        type: 'utility',
        relevance: 'low',
        reason: Labels.reuse.existingDbScript(ds.type, ds.tables.join(', ')),
      });
    }

    // ── Sort and score ────────────────────────────────────
    candidates.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.relevance] - order[b.relevance];
    });

    const totalAssets = repo.reusableComponents.length + repo.services.length
      + repo.repositories.length + repo.controllers.length;
    const reuseScore = totalAssets > 0 ? Math.round((candidates.length / totalAssets) * 100) : 0;

    const highCount = candidates.filter((c) => c.relevance === 'high').length;
    const mediumCount = candidates.filter((c) => c.relevance === 'medium').length;
    const summary = candidates.length > 0
      ? Labels.reuse.summaryFound(candidates.length, highCount, mediumCount, reuseScore, totalAssets)
      : Labels.reuse.summaryNone(totalAssets);

    return { candidates, summary, reuseScore };
  }

  private extractKeywords(requirements: RequirementsAnalysis): string[] {
    const all = [...requirements.functionalRequirements, ...requirements.nonFunctionalRequirements];
    const text = all.map((r) => r.description).join(' ').toLowerCase();
    const stopWords = new Set([
      'the','a','an','is','are','was','were','be','been','being',
      'have','has','had','do','does','did','will','would','shall',
      'should','may','might','can','could','must','need','to','of',
      'in','for','on','with','at','by','from','as','into','through',
      'during','before','after','above','below','between','out','off',
      'over','under','again','further','then','once','that','this',
      'these','those','and','but','or','nor','not','so','if','when',
      'where','how','what','which','who','whom','why','all','each',
      'every','both','few','more','most','other','some','such','no',
      'only','very','existing','using','follow','apply','implement',
      'integrate','enforce','validate','review','modify','create',
      'new','module','pattern','infrastructure','convention',
    ]);
    const words = text.match(/\b[a-z]{3,}\b/g) ?? [];
    return [...new Set(words.filter((w) => !stopWords.has(w)))];
  }

  private computeRelevance(
    name: string,
    members: string[],
    keywords: string[],
  ): 'high' | 'medium' | 'low' | null {
    const nameLower = name.toLowerCase();
    const nameMatch = keywords.some((k) => nameLower.includes(k));
    const memberMatches = members.filter((m) =>
      keywords.some((k) => m.toLowerCase().includes(k)),
    ).length;

    if (nameMatch && memberMatches >= 2) return 'high';
    if (nameMatch || memberMatches >= 2) return 'medium';
    if (memberMatches >= 1) return 'low';
    return null;
  }

  private detectEndpointPatterns(
    endpoints: { method: string; route: string; filePath: string }[],
  ): { method: string; pattern: string; filePath: string }[] {
    // Group by route prefix and extract CRUD-like patterns
    const patterns: { method: string; pattern: string; filePath: string }[] = [];
    const seen = new Set<string>();

    for (const ep of endpoints) {
      // Generalize route: /api/users/:id → /api/<resource>/:id
      const generalized = ep.route.replace(/\/[a-z-]+/g, (seg) => {
        if (seg.startsWith('/:')) return seg;
        return seg;
      });
      const key = `${ep.method} ${generalized}`;
      if (!seen.has(key) && patterns.length < 5) {
        seen.add(key);
        patterns.push({ method: ep.method, pattern: generalized, filePath: ep.filePath });
      }
    }
    return patterns;
  }
}
