import * as fs from 'fs';
import * as path from 'path';
import { BaseAgent } from '../core';
import { Labels } from '../config';
import {
  AgentRole,
  FeatureContext,
  SessionContext,
} from '../types';

/**
 * Generates comprehensive Markdown documentation from the full analysis
 * pipeline. Includes Mermaid architecture and data-flow diagrams, specific
 * file paths, tabular summaries, and cross-referenced sections.
 */
export class DocumentationGeneratorAgent extends BaseAgent<FeatureContext, string> {
  readonly role = AgentRole.DocumentationGenerator;
  readonly name = 'Documentation Generator';

  protected async run(fc: FeatureContext, context: SessionContext): Promise<string> {
    const repo = fc.repositoryContext;
    const repoIndex = fc.repoIndex;
    const requirementsAnalysis = fc.requirementsAnalysis;
    const scopeDefinition = fc.scopeDefinition;
    const reuseAnalysis = fc.reuseAnalysis;
    const solutionArchitecture = fc.solutionArchitecture;
    const impactAnalysis = fc.impactAnalysis;
    const estimation = fc.estimation;

    const featureName = fc.rawRequirements?.substring(0, 80) ?? 'Feature';
    const lines: string[] = [];

    lines.push(`# ${Labels.documentation.solutionAnalysis(featureName)}`);
    lines.push('');
    lines.push(`> ${Labels.common.generatedAt} ${new Date().toISOString()}`);
    lines.push('');

    // ── Table of contents ─────────────────────────────────
    lines.push(`## ${Labels.documentation.tableOfContents}`);
    lines.push('');
    for (let i = 0; i < Labels.documentation.toc.length; i++) {
      const entry = Labels.documentation.toc[i];
      lines.push(`${i + 1}. [${entry.label}](#${entry.anchor})`);
    }
    lines.push('');

    // ── Repository overview ────────────────────────────────
    lines.push(`## ${Labels.documentation.repositoryOverview}`);
    lines.push('');
    if (repo) {
      lines.push(`| ${Labels.common.metric} | ${Labels.common.value} |`);
      lines.push(`|--------|-------|`);
      lines.push(`| ${Labels.documentation.project} | ${repo.meta.name} |`);
      lines.push(`| ${Labels.documentation.totalFiles} | ${repo.meta.totalFiles.toLocaleString()} |`);
      lines.push(`| ${Labels.documentation.totalLines} | ${repo.meta.totalLines.toLocaleString()} |`);
      lines.push(`| ${Labels.documentation.architecture} | ${repo.architecturePattern.primary} |`);
      lines.push(`| ${Labels.documentation.services} | ${repo.services.length} |`);
      lines.push(`| ${Labels.documentation.controllers} | ${repo.controllers.length} |`);
      lines.push(`| ${Labels.documentation.repositories} | ${repo.repositories.length} |`);
      lines.push(`| ${Labels.documentation.apiEndpoints} | ${repo.apiEndpoints.length} |`);
      lines.push('');

      if (repo.languages.length > 0) {
        lines.push(`### ${Labels.documentation.languageBreakdown}`);
        lines.push('');
        lines.push(`| ${Labels.documentation.language} | ${Labels.common.files} | ${Labels.documentation.lines} | ${Labels.documentation.percentage} |`);
        lines.push('|----------|-------|-------|---|');
        for (const lang of repo.languages.sort((a, b) => b.lines - a.lines)) {
          lines.push(`| ${lang.language} | ${lang.files} | ${lang.lines.toLocaleString()} | ${lang.percentage.toFixed(1)}% |`);
        }
        lines.push('');
      }

      if (repo.frameworks.length > 0) {
        lines.push(`### ${Labels.documentation.detectedFrameworks}`);
        lines.push('');
        lines.push(`| ${Labels.documentation.framework} | ${Labels.documentation.version} | ${Labels.documentation.confidence} |`);
        lines.push('|-----------|---------|------------|');
        for (const fw of repo.frameworks) {
          lines.push(`| ${fw.name} | ${fw.version ?? '-'} | ${fw.confidence} |`);
        }
        lines.push('');
      }
    } else if (repoIndex) {
      lines.push(`- **${Labels.documentation.totalFiles}**: ${repoIndex.files.length}`);
      lines.push(`- **${Labels.documentation.totalLines}**: ${repoIndex.totalLines.toLocaleString()}`);
      lines.push(`- **${Labels.common.dependencies}**: ${repoIndex.dependencies.length}`);
      lines.push('');
    }

    // ── Requirements ───────────────────────────────────────
    if (requirementsAnalysis) {
      lines.push(`## ${Labels.documentation.requirements}`);
      lines.push('');

      if (requirementsAnalysis.functionalRequirements.length > 0) {
        lines.push(`### ${Labels.requirements.functional}`);
        lines.push('');
        lines.push(`| ${Labels.requirements.id} | ${Labels.common.priority} | ${Labels.common.category} | ${Labels.common.description} |`);
        lines.push('|----|----------|----------|-------------|');
        for (const r of requirementsAnalysis.functionalRequirements) {
          lines.push(`| ${r.id} | ${this.priorityBadge(r.priority)} | ${r.category} | ${r.description} |`);
        }
        lines.push('');
      }

      if (requirementsAnalysis.nonFunctionalRequirements.length > 0) {
        lines.push(`### ${Labels.requirements.nonFunctional}`);
        lines.push('');
        lines.push(`| ${Labels.requirements.id} | ${Labels.common.priority} | ${Labels.common.category} | ${Labels.common.description} |`);
        lines.push('|----|----------|----------|-------------|');
        for (const r of requirementsAnalysis.nonFunctionalRequirements) {
          lines.push(`| ${r.id} | ${this.priorityBadge(r.priority)} | ${r.category} | ${r.description} |`);
        }
        lines.push('');
      }

      if (requirementsAnalysis.assumptions.length > 0) {
        lines.push(`### ${Labels.requirements.assumptions}`);
        lines.push('');
        for (const a of requirementsAnalysis.assumptions) lines.push(`- ${a}`);
        lines.push('');
      }

      if (requirementsAnalysis.constraints.length > 0) {
        lines.push(`### ${Labels.requirements.constraints}`);
        lines.push('');
        for (const c of requirementsAnalysis.constraints) lines.push(`- ${c}`);
        lines.push('');
      }
    }

    // ── Scope ──────────────────────────────────────────────
    if (scopeDefinition) {
      lines.push(`## ${Labels.documentation.scope}`);
      lines.push('');
      lines.push(`**${Labels.scope.estimatedComplexity}**: ${scopeDefinition.estimatedComplexity}`);
      lines.push('');

      if (scopeDefinition.affectedModules.length > 0) {
        lines.push(`### ${Labels.scope.affectedModules}`);
        lines.push('');
        for (const mod of scopeDefinition.affectedModules) lines.push(`- \`${mod}\``);
        lines.push('');
      }

      if (scopeDefinition.newModules.length > 0) {
        lines.push(`### ${Labels.scope.newModules}`);
        lines.push('');
        for (const mod of scopeDefinition.newModules) lines.push(`- \`${mod}\``);
        lines.push('');
      }

      lines.push(`### ${Labels.scope.inScope}`);
      lines.push('');
      lines.push(`| ${Labels.common.type} | ${Labels.scope.area} | ${Labels.common.description} |`);
      lines.push('|------|------|-------------|');
      for (const s of scopeDefinition.inScope) {
        lines.push(`| ${s.type} | ${s.area} | ${s.description} |`);
      }
      lines.push('');

      if (scopeDefinition.outOfScope.length > 0) {
        lines.push(`### ${Labels.scope.outOfScope}`);
        lines.push('');
        for (const item of scopeDefinition.outOfScope) lines.push(`- ${item}`);
        lines.push('');
      }
    }

    // ── Reuse Analysis ────────────────────────────────────
    if (reuseAnalysis) {
      lines.push(`## ${Labels.documentation.reuseAnalysis}`);
      lines.push('');
      lines.push(`**${Labels.reuse.reuseScore}**: ${reuseAnalysis.reuseScore}%`);
      lines.push('');
      lines.push(reuseAnalysis.summary);
      lines.push('');

      if (reuseAnalysis.candidates.length > 0) {
        lines.push(`### ${Labels.reuse.reusableAssets}`);
        lines.push('');
        lines.push(`| ${Labels.common.name} | ${Labels.common.type} | ${Labels.reuse.relevance} | ${Labels.common.file} | ${Labels.reuse.reason} |`);
        lines.push('|------|------|-----------|------|--------|');
        for (const c of reuseAnalysis.candidates) {
          lines.push(`| ${c.name} | ${c.type} | ${this.relevanceBadge(c.relevance)} | \`${c.filePath}\` | ${c.reason} |`);
        }
        lines.push('');
      }
    }

    // ── Solution Architecture ─────────────────────────────
    if (solutionArchitecture) {
      lines.push(`## ${Labels.documentation.solutionArchitecture}`);
      lines.push('');
      lines.push(solutionArchitecture.overview);
      lines.push('');

      // Component diagram (Mermaid)
      if (solutionArchitecture.proposedComponents.length > 0) {
        lines.push(`### ${Labels.solution.componentDiagram}`);
        lines.push('');
        lines.push('```mermaid');
        lines.push('graph TD');
        const newComps = solutionArchitecture.proposedComponents.filter((c) => c.isNew);
        const modComps = solutionArchitecture.proposedComponents.filter((c) => !c.isNew);

        for (const c of newComps) {
          const id = this.mermaidId(c.name);
          lines.push(`    ${id}["${c.name}<br/><small>${c.type}</small>"]:::new`);
        }
        for (const c of modComps) {
          const id = this.mermaidId(c.name);
          lines.push(`    ${id}["${c.name}<br/><small>${c.type} - ${Labels.common.modified}</small>"]:::modified`);
        }

        // Draw dependency edges
        for (const c of solutionArchitecture.proposedComponents) {
          for (const dep of c.dependencies) {
            const from = this.mermaidId(c.name);
            const to = this.mermaidId(dep);
            lines.push(`    ${from} --> ${to}`);
          }
        }

        lines.push('    classDef new fill:#d4edda,stroke:#28a745');
        lines.push('    classDef modified fill:#fff3cd,stroke:#ffc107');
        lines.push('```');
        lines.push('');
      }

      lines.push(`### ${Labels.solution.proposedComponents}`);
      lines.push('');
      lines.push(`| ${Labels.common.component} | ${Labels.common.type} | ${Labels.documentation.newQuestion} | ${Labels.common.dependencies} | ${Labels.common.description} |`);
      lines.push('|-----------|------|------|--------------|-------------|');
      for (const c of solutionArchitecture.proposedComponents) {
        const deps = c.dependencies.length > 0 ? c.dependencies.join(', ') : '-';
        lines.push(`| ${c.name} | ${c.type} | ${c.isNew ? `**${Labels.common.yes}**` : Labels.common.no} | ${deps} | ${c.description} |`);
      }
      lines.push('');

      // Data flow diagram (Mermaid)
      if (solutionArchitecture.dataFlows.length > 0) {
        lines.push(`### ${Labels.solution.dataFlowDiagram}`);
        lines.push('');
        lines.push('```mermaid');
        lines.push('sequenceDiagram');
        for (const df of solutionArchitecture.dataFlows) {
          const from = df.from.replace(/[^a-zA-Z0-9]/g, '');
          const to = df.to.replace(/[^a-zA-Z0-9]/g, '');
          lines.push(`    ${from}->>+${to}: ${df.data}`);
          lines.push(`    Note right of ${to}: ${df.description}`);
        }
        lines.push('```');
        lines.push('');
      }

      if (solutionArchitecture.integrations.length > 0) {
        lines.push(`### ${Labels.solution.integrations}`);
        lines.push('');
        lines.push(`| ${Labels.documentation.source} | ${Labels.documentation.target} | ${Labels.common.type} | ${Labels.common.description} |`);
        lines.push('|--------|--------|------|-------------|');
        for (const i of solutionArchitecture.integrations) {
          lines.push(`| ${i.source} | ${i.target} | ${i.type} | ${i.description} |`);
        }
        lines.push('');
      }

      if (solutionArchitecture.technologyStack.length > 0) {
        lines.push(`### ${Labels.solution.technologyStack}`);
        lines.push('');
        for (const t of solutionArchitecture.technologyStack) lines.push(`- ${t}`);
        lines.push('');
      }
    }

    // ── Impact Analysis ───────────────────────────────────
    if (impactAnalysis) {
      lines.push(`## ${Labels.documentation.impactAnalysis}`);
      lines.push('');
      lines.push(`**${Labels.impact.riskLevel}**: ${this.riskBadge(impactAnalysis.riskLevel)}`);
      lines.push('');

      if (impactAnalysis.impactedAreas.length > 0) {
        lines.push(`### ${Labels.impact.impactedAreas}`);
        lines.push('');
        lines.push(`| ${Labels.impact.impact} | ${Labels.scope.area} | ${Labels.common.files} | ${Labels.common.description} |`);
        lines.push('|--------|------|-------|-------------|');
        for (const a of impactAnalysis.impactedAreas) {
          const fileList = a.files.length > 0 ? a.files.map((f) => `\`${f}\``).join(', ') : '-';
          lines.push(`| ${this.impactBadge(a.impact)} | ${a.area} | ${fileList} | ${a.description} |`);
        }
        lines.push('');
      }

      if (impactAnalysis.breakingChanges.length > 0) {
        lines.push(`### ${Labels.impact.breakingChanges}`);
        lines.push('');
        for (const bc of impactAnalysis.breakingChanges) lines.push(`- ⚠️ ${bc}`);
        lines.push('');
      }

      if (impactAnalysis.migrationNotes.length > 0) {
        lines.push(`### ${Labels.impact.migrationNotes}`);
        lines.push('');
        for (const mn of impactAnalysis.migrationNotes) lines.push(`- ${mn}`);
        lines.push('');
      }

      if (impactAnalysis.testingRecommendations.length > 0) {
        lines.push(`### ${Labels.impact.testingRecommendations}`);
        lines.push('');
        for (const t of impactAnalysis.testingRecommendations) lines.push(`- [ ] ${t}`);
        lines.push('');
      }
    }

    // ── Estimation ─────────────────────────────────────────
    if (estimation) {
      lines.push(`## ${Labels.documentation.estimation}`);
      lines.push('');
      lines.push(`| ${Labels.common.metric} | ${Labels.common.value} |`);
      lines.push(`|--------|-------|`);
      lines.push(`| **${Labels.estimation.totalHours}** | ${estimation.totalHours} |`);
      lines.push(`| **${Labels.estimation.confidence}** | ${estimation.confidence} |`);
      lines.push(`| **${Labels.estimation.tasks}** | ${estimation.breakdown.length} |`);
      lines.push('');
      lines.push(`### ${Labels.estimation.breakdown}`);
      lines.push('');
      lines.push(`| ${Labels.estimation.task} | ${Labels.estimation.hours} | ${Labels.estimation.complexity} |`);
      lines.push('|------|------:|:----------:|');
      for (const item of estimation.breakdown) {
        lines.push(`| ${item.task} | ${item.hours} | ${item.complexity} |`);
      }
      lines.push('');

      // Effort distribution bar
      const totalHours = estimation.totalHours;
      if (totalHours > 0) {
        const categories = new Map<string, number>();
        for (const item of estimation.breakdown) {
          const cat = this.categorizeTask(item.task);
          categories.set(cat, (categories.get(cat) ?? 0) + item.hours);
        }
        lines.push(`### ${Labels.estimation.effortDistribution}`);
        lines.push('');
        for (const [cat, hours] of categories) {
          const pct = Math.round((hours / totalHours) * 100);
          const bar = '█'.repeat(Math.max(1, Math.round(pct / 5)));
          lines.push(`- **${cat}**: ${hours}h (${pct}%) ${bar}`);
        }
        lines.push('');
      }
    }

    // ── Summary ───────────────────────────────────────────
    lines.push(`## ${Labels.documentation.summary}`);
    lines.push('');
    const newCount = solutionArchitecture?.proposedComponents.filter((c) => c.isNew).length ?? 0;
    const modCount = solutionArchitecture?.proposedComponents.filter((c) => !c.isNew).length ?? 0;
    const reuseCount = reuseAnalysis?.candidates.length ?? 0;

    lines.push(`| ${Labels.common.aspect} | ${Labels.common.detail} |`);
    lines.push(`|--------|--------|`);
    lines.push(`| ${Labels.documentation.newComponents} | ${newCount} |`);
    lines.push(`| ${Labels.documentation.modifiedComponents} | ${modCount} |`);
    lines.push(`| ${Labels.documentation.reusableAssets} | ${reuseCount} |`);
    lines.push(`| ${Labels.impact.riskLevel} | ${impactAnalysis?.riskLevel ?? '-'} |`);
    lines.push(`| ${Labels.documentation.estimatedHours} | ${estimation?.totalHours ?? '-'} |`);
    lines.push(`| ${Labels.estimation.confidence} | ${estimation?.confidence ?? '-'} |`);
    lines.push(`| ${Labels.scope.estimatedComplexity} | ${scopeDefinition?.estimatedComplexity ?? '-'} |`);
    lines.push('');

    const markdown = lines.join('\n');

    const outDir = context.config.output.dir;
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outPath = path.join(outDir, 'documentation.md');
    fs.writeFileSync(outPath, markdown, 'utf-8');
    this.logger.info(`Documentation written to ${outPath}`);

    return markdown;
  }

  private priorityBadge(p: string): string {
    return p === 'must' ? '🔴 must' : p === 'should' ? '🟡 should' : '🟢 could';
  }

  private relevanceBadge(r: string): string {
    return r === 'high' ? '🟢 high' : r === 'medium' ? '🟡 medium' : '⚪ low';
  }

  private riskBadge(r: string): string {
    return r === 'high' ? '🔴 HIGH' : r === 'medium' ? '🟡 MEDIUM' : '🟢 LOW';
  }

  private impactBadge(i: string): string {
    return i === 'high' ? '🔴 high' : i === 'medium' ? '🟡 medium' : '🟢 low';
  }

  private mermaidId(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private categorizeTask(task: string): string {
    const t = task.toLowerCase();
    if (t.includes('test') || t.includes('regressão') || t.includes('segurança')) return Labels.estimation.catTesting;
    if (t.includes('migração') || t.includes('migration') || t.includes('rollback')) return Labels.estimation.catDatabase;
    if (t.includes('compreensão') || t.includes('familiariza') || t.includes('comprehension')) return Labels.estimation.catAnalysis;
    if (t.includes('integração') || t.includes('integration') || t.includes('wiring')) return Labels.estimation.catIntegration;
    if (t.includes('revisão') || t.includes('review') || t.includes('documentação')) return Labels.estimation.catReview;
    return Labels.estimation.catImplementation;
  }
}
