import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../core';
import { Labels } from '../config';
import { FeatureContext, PipelineResult } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a free-text description into a URL/folder-safe slug. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

/** Create a directory (and parents) if it doesn't exist. */
function ensureDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Write a UTF-8 Markdown file. */
function writeMarkdown(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8');
}

/** Write a JSON file with 2-space indentation. */
function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── OutputGenerator ──────────────────────────────────────────────────────────

/** Writes per-feature documentation into docs/features/<slug>/. */
export class OutputGenerator {
  private readonly logger = Logger.child('OutputGenerator');

  /**
   * Write all output files and return the resolved output folder path.
   * If the target folder already exists, a timestamp suffix is appended.
   */
  write(result: PipelineResult, baseDir: string): string {
    const fc = result.context;
    const slug = slugify(result.featureName || 'unnamed-feature');
    let featureDir = path.join(baseDir, 'docs', 'features', slug);

    if (fs.existsSync(featureDir)) {
      featureDir = `${featureDir}-${Date.now()}`;
    }

    ensureDirectory(featureDir);

    // Attach file transport so all subsequent logs are also written to pipeline.log
    const logFilePath = path.join(featureDir, 'pipeline.log');
    Logger.addFileTransport(logFilePath);

    this.logger.info(`Output folder: ${featureDir}`);

    // Replay pipeline execution summary into the log file
    this.logPipelineSummary(result);

    // requirements.md
    this.writeRequirements(featureDir, fc);

    // scope.md
    this.writeScope(featureDir, fc);

    // solution.md
    this.writeSolution(featureDir, fc);

    // impact.md
    this.writeImpact(featureDir, fc);

    // estimation.md
    this.writeEstimation(featureDir, fc);

    // documentation.md
    this.writeDocumentation(featureDir, fc);

    // git-analysis.md
    this.writeGitAnalysis(featureDir, fc);

    // project-discovery.md
    this.writeProjectDiscovery(featureDir, fc);

    // flowcharts.md
    this.writeFlowcharts(featureDir, fc);

    // technical.md
    this.writeTechnicalDoc(featureDir, fc);

    // executive.md
    this.writeExecutiveDoc(featureDir, fc);

    // summary.md
    this.writeSummary(featureDir, fc);

    // language-analysis.md
    this.writeLanguageAnalysis(featureDir, fc);

    // coherence.md
    this.writeCoherence(featureDir, fc);

    // implementation.md + implementation/ files
    this.writeImplementation(featureDir, fc);

    // feature-context.json
    const ctxPath = path.join(featureDir, 'feature-context.json');
    writeJson(ctxPath, fc);
    this.logger.info(`Written: ${ctxPath}`);

    // pipeline-result.json (metadata without the heavy context)
    const resultMeta = { ...result, context: undefined };
    const resultPath = path.join(featureDir, 'pipeline-result.json');
    writeJson(resultPath, resultMeta);
    this.logger.info(`Written: ${resultPath}`);

    // Detach the file transport now that output is complete
    Logger.removeFileTransport();

    return featureDir;
  }

  // ── Individual file writers ────────────────────────────────────────────────

  private writeRequirements(dir: string, fc: FeatureContext): void {
    const filePath = path.join(dir, 'requirements.md');
    const req = fc.requirementsAnalysis;
    const lines: string[] = [`# ${Labels.requirements.title}`, ''];

    if (!req) {
      lines.push(Labels.requirements.noAnalysis);
    } else {
      if (req.functionalRequirements.length > 0) {
        lines.push(`## ${Labels.requirements.functional}`, '');
        for (const r of req.functionalRequirements) {
          const sourceTag = r.source ? ` _[${r.source}]_` : '';
          lines.push(`- **${r.id}** [${r.priority}] (${r.category}) ${r.description}${sourceTag}`);
          if (r.acceptanceCriteria && r.acceptanceCriteria.length > 0) {
            for (const ac of r.acceptanceCriteria) {
              lines.push(`  - ✓ ${ac}`);
            }
          }
          if (r.relatedComponents && r.relatedComponents.length > 0) {
            lines.push(`  - _Componentes: ${r.relatedComponents.join(', ')}_`);
          }
        }
        lines.push('');
      }
      if (req.nonFunctionalRequirements.length > 0) {
        lines.push(`## ${Labels.requirements.nonFunctional}`, '');
        for (const r of req.nonFunctionalRequirements) {
          const sourceTag = r.source ? ` _[${r.source}]_` : '';
          lines.push(`- **${r.id}** [${r.priority}] (${r.category}) ${r.description}${sourceTag}`);
          if (r.acceptanceCriteria && r.acceptanceCriteria.length > 0) {
            for (const ac of r.acceptanceCriteria) {
              lines.push(`  - ✓ ${ac}`);
            }
          }
        }
        lines.push('');
      }
      if (req.assumptions.length > 0) {
        lines.push(`## ${Labels.requirements.assumptions}`, '');
        for (const a of req.assumptions) lines.push(`- ${a}`);
        lines.push('');
      }
      if (req.constraints.length > 0) {
        lines.push(`## ${Labels.requirements.constraints}`, '');
        for (const c of req.constraints) lines.push(`- ${c}`);
        lines.push('');
      }
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);
  }

  private writeScope(dir: string, fc: FeatureContext): void {
    const filePath = path.join(dir, 'scope.md');
    const scope = fc.scopeDefinition;
    const lines: string[] = [`# ${Labels.scope.title}`, ''];

    if (!scope) {
      lines.push('_Nenhuma definição de escopo foi gerada._');
    } else {
      lines.push(`**${Labels.scope.estimatedComplexity}**: ${scope.estimatedComplexity}`, '');

      if (scope.inScope.length > 0) {
        lines.push(`## ${Labels.scope.inScope}`, '');
        for (const s of scope.inScope) {
          lines.push(`- [${s.type}] **${s.area}** — ${s.description}`);
        }
        lines.push('');
      }
      if (scope.outOfScope.length > 0) {
        lines.push(`## ${Labels.scope.outOfScope}`, '');
        for (const item of scope.outOfScope) lines.push(`- ${item}`);
        lines.push('');
      }
      if (scope.affectedModules.length > 0) {
        lines.push(`## ${Labels.scope.affectedModules}`, '');
        for (const m of scope.affectedModules) lines.push(`- ${m}`);
        lines.push('');
      }
      if (scope.newModules.length > 0) {
        lines.push(`## ${Labels.scope.newModules}`, '');
        for (const m of scope.newModules) lines.push(`- ${m}`);
        lines.push('');
      }
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);
  }

  private writeSolution(dir: string, fc: FeatureContext): void {
    const filePath = path.join(dir, 'solution.md');
    const sol = fc.solutionArchitecture;
    const lines: string[] = [`# ${Labels.solution.title}`, ''];

    if (!sol) {
      lines.push(Labels.solution.noSolution);
    } else {
      lines.push(sol.overview, '');

      if (sol.proposedComponents.length > 0) {
        lines.push(`## ${Labels.solution.proposedComponents}`, '');
        lines.push(`| ${Labels.common.component} | ${Labels.common.type} | ${Labels.documentation.newQuestion} | ${Labels.common.description} |`);
        lines.push('|-----------|------|------|-------------|');
        for (const c of sol.proposedComponents) {
          lines.push(`| ${c.name} | ${c.type} | ${c.isNew ? Labels.common.yes : Labels.common.no} | ${c.description} |`);
        }
        lines.push('');
      }

      if (sol.integrations.length > 0) {
        lines.push(`## ${Labels.solution.integrations}`, '');
        for (const i of sol.integrations) {
          lines.push(`- **${i.source}** → **${i.target}** (${i.type}): ${i.description}`);
        }
        lines.push('');
      }

      if (sol.dataFlows.length > 0) {
        lines.push(`## ${Labels.solution.dataFlows}`, '');
        for (const df of sol.dataFlows) {
          lines.push(`- **${df.from}** → **${df.to}**: ${df.data} — ${df.description}`);
        }
        lines.push('');
      }

      if (sol.technologyStack.length > 0) {
        lines.push(`## ${Labels.solution.technologyStack}`, '');
        for (const t of sol.technologyStack) lines.push(`- ${t}`);
        lines.push('');
      }
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);
  }

  private writeImpact(dir: string, fc: FeatureContext): void {
    const filePath = path.join(dir, 'impact.md');
    const impact = fc.impactAnalysis;
    const lines: string[] = [`# ${Labels.impact.title}`, ''];

    if (!impact) {
      lines.push(Labels.impact.noAnalysis);
    } else {
      lines.push(`**${Labels.impact.riskLevel}**: ${impact.riskLevel}`, '');

      if (impact.impactedAreas.length > 0) {
        lines.push(`## ${Labels.impact.impactedAreas}`, '');
        for (const area of impact.impactedAreas) {
          lines.push(`### ${area.area} (${area.impact})`);
          lines.push(area.description);
          if (area.files.length > 0) {
            lines.push('', 'Files:');
            for (const f of area.files) lines.push(`- \`${f}\``);
          }
          lines.push('');
        }
      }

      if (impact.breakingChanges.length > 0) {
        lines.push(`## ${Labels.impact.breakingChanges}`, '');
        for (const bc of impact.breakingChanges) lines.push(`- ${bc}`);
        lines.push('');
      }

      if (impact.testingRecommendations.length > 0) {
        lines.push(`## ${Labels.impact.testingRecommendations}`, '');
        for (const t of impact.testingRecommendations) lines.push(`- ${t}`);
        lines.push('');
      }

      if (impact.migrationNotes.length > 0) {
        lines.push(`## ${Labels.impact.migrationNotes}`, '');
        for (const m of impact.migrationNotes) lines.push(`- ${m}`);
        lines.push('');
      }
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);
  }

  private writeEstimation(dir: string, fc: FeatureContext): void {
    const filePath = path.join(dir, 'estimation.md');
    const est = fc.estimation;
    const lines: string[] = [`# ${Labels.estimation.title}`, ''];

    if (!est) {
      lines.push(Labels.estimation.noEstimation);
    } else {
      lines.push(`**${Labels.estimation.totalHours}**: ${est.totalHours}`);
      lines.push(`**${Labels.estimation.confidence}**: ${est.confidence}`);
      if (est.storyPoints) lines.push(`**Story Points**: ${est.storyPoints}`);
      lines.push('');

      // ── Scenarios ──────────────────────────────────────
      if (est.scenarios) {
        lines.push('## Cenários de Estimativa', '');
        lines.push('| Cenário | Horas | Dias |');
        lines.push('|---|---|---|');
        lines.push(`| Desenvolvimento Humano | ${est.scenarios.human.hours}h | ${est.scenarios.human.days}d |`);
        lines.push(`| Com GitHub Copilot (-${est.scenarios.withCopilot.gain}) | ${est.scenarios.withCopilot.hours}h | ${est.scenarios.withCopilot.days}d |`);
        lines.push(`| Abordagem Híbrida (-${est.scenarios.hybrid.gain}) | ${est.scenarios.hybrid.hours}h | ${est.scenarios.hybrid.days}d |`);
        lines.push('');
      }

      // ── Breakdown ──────────────────────────────────────
      if (est.breakdown.length > 0) {
        lines.push(`## ${Labels.estimation.breakdown}`, '');
        lines.push(`| ${Labels.estimation.task} | ${Labels.estimation.hours} | ${Labels.estimation.complexity} |`);
        lines.push('|------|-------|------------|');
        for (const item of est.breakdown) {
          lines.push(`| ${item.task} | ${item.hours} | ${item.complexity} |`);
        }
        lines.push('');
      }

      // ── Timeline ───────────────────────────────────────
      if (est.suggestedTimeline && est.suggestedTimeline.length > 0) {
        lines.push('## Cronograma Sugerido', '');
        lines.push('| Fase | Dias | Paralelizável |');
        lines.push('|---|---|---|');
        for (const tp of est.suggestedTimeline) {
          lines.push(`| ${tp.phase} | ${tp.days}d | ${tp.parallelizable ? 'Sim' : 'Não'} |`);
        }
        lines.push('');
      }

      // ── Risks ──────────────────────────────────────────
      if (est.estimationRisks && est.estimationRisks.length > 0) {
        lines.push('## Riscos da Estimativa', '');
        for (const r of est.estimationRisks) {
          const direction = r.impact === 'increase' ? '↑' : '↓';
          lines.push(`- ${direction} ${r.risk} (fator: ${r.factor}x)`);
        }
        lines.push('');
      }
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);
  }

  private writeDocumentation(dir: string, fc: FeatureContext): void {
    const filePath = path.join(dir, 'documentation.md');

    if (fc.documentation) {
      writeMarkdown(filePath, fc.documentation);
    } else {
      writeMarkdown(filePath, `# ${Labels.documentation.title}\n\n${Labels.documentation.noDocumentation}\n`);
    }

    this.logger.info(`Written: ${filePath}`);
  }

  private writeGitAnalysis(dir: string, fc: FeatureContext): void {
    if (!fc.gitAnalysis) return;
    const filePath = path.join(dir, 'git-analysis.md');
    const git = fc.gitAnalysis;
    const lines: string[] = [`# ${Labels.git.title}`, ''];

    lines.push(`**${Labels.git.totalCommits}**: ${git.recentCommits.length}`);
    lines.push(`**${Labels.git.activeBranch}**: ${git.branchInfo.current}`);
    lines.push(`**${Labels.git.branches}**: ${git.branchInfo.branches.join(', ')}`, '');

    if (git.activeAuthors.length > 0) {
      lines.push(`## ${Labels.git.authors}`, '');
      for (const a of git.activeAuthors) lines.push(`- ${a}`);
      lines.push('');
    }

    if (git.hotFiles.length > 0) {
      lines.push(`## ${Labels.git.hotFiles}`, '');
      for (const f of git.hotFiles) lines.push(`- ${f}`);
      lines.push('');
    }

    if (git.recentCommits.length > 0) {
      lines.push(`## ${Labels.git.recentCommits}`, '');
      for (const c of git.recentCommits.slice(0, 20)) {
        lines.push(`- \`${c.hash.slice(0, 7)}\` ${c.message} — ${c.author} (${c.date})`);
      }
      lines.push('');
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);
  }

  private writeProjectDiscovery(dir: string, fc: FeatureContext): void {
    if (!fc.projectDiscovery) return;
    const filePath = path.join(dir, 'project-discovery.md');
    const pd = fc.projectDiscovery;
    const lines: string[] = [`# ${Labels.projectDiscovery.title}`, ''];

    lines.push(`**${Labels.projectDiscovery.totalProjects}**: ${pd.projects.length}`);
    lines.push(`**${Labels.projectDiscovery.monorepo}**: ${pd.monorepo ? Labels.common.yes : Labels.common.no}`, '');

    if (pd.projects.length > 0) {
      lines.push(`## ${Labels.projectDiscovery.discoveredProjects}`, '');
      lines.push(`| ${Labels.projectDiscovery.projectName} | ${Labels.projectDiscovery.projectType} | ${Labels.projectDiscovery.projectPath} |`);
      lines.push('|---|---|---|');
      for (const p of pd.projects) {
        lines.push(`| ${p.name} | ${p.type} | ${p.path} |`);
      }
      lines.push('');
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);
  }

  private writeFlowcharts(dir: string, fc: FeatureContext): void {
    if (!fc.flowcharts || fc.flowcharts.length === 0) return;
    const filePath = path.join(dir, 'flowcharts.md');
    const lines: string[] = [`# ${Labels.flowchart.title}`, ''];

    for (const chart of fc.flowcharts) {
      lines.push(`## ${chart.title}`, '');
      lines.push(chart.description, '');
      lines.push('```mermaid');
      lines.push(chart.mermaidCode);
      lines.push('```');
      lines.push('');
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);
  }

  private writeTechnicalDoc(dir: string, fc: FeatureContext): void {
    if (!fc.documentationPackage?.technical) return;
    const filePath = path.join(dir, 'technical.md');
    writeMarkdown(filePath, fc.documentationPackage.technical);
    this.logger.info(`Written: ${filePath}`);
  }

  private writeExecutiveDoc(dir: string, fc: FeatureContext): void {
    if (!fc.documentationPackage?.executive) return;
    const filePath = path.join(dir, 'executive.md');
    writeMarkdown(filePath, fc.documentationPackage.executive);
    this.logger.info(`Written: ${filePath}`);
  }

  private writeSummary(dir: string, fc: FeatureContext): void {
    if (!fc.documentationPackage?.summary) return;
    const filePath = path.join(dir, 'summary.md');
    writeMarkdown(filePath, fc.documentationPackage.summary);
    this.logger.info(`Written: ${filePath}`);
  }

  private writeLanguageAnalysis(dir: string, fc: FeatureContext): void {
    if (!fc.languageAnalyses || fc.languageAnalyses.length === 0) return;
    const filePath = path.join(dir, 'language-analysis.md');
    const lines: string[] = [`# ${Labels.languageSpecialist.title}`, ''];

    for (const analysis of fc.languageAnalyses) {
      lines.push(`## ${analysis.language}`, '');

      if (analysis.patterns.length > 0) {
        lines.push(`### ${Labels.languageSpecialist.patterns}`, '');
        for (const p of analysis.patterns) lines.push(`- ${p}`);
        lines.push('');
      }

      if (analysis.recommendations.length > 0) {
        lines.push(`### ${Labels.languageSpecialist.recommendations}`, '');
        for (const r of analysis.recommendations) lines.push(`- ${r}`);
        lines.push('');
      }

      if (analysis.bestPractices.length > 0) {
        lines.push(`### ${Labels.languageSpecialist.bestPractices}`, '');
        for (const b of analysis.bestPractices) lines.push(`- ${b}`);
        lines.push('');
      }

      if (analysis.codeSmells.length > 0) {
        lines.push(`### ${Labels.languageSpecialist.antiPatterns}`, '');
        for (const a of analysis.codeSmells) lines.push(`- ${a}`);
        lines.push('');
      }
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);
  }

  private writeImplementation(dir: string, fc: FeatureContext): void {
    if (!fc.implementation) return;
    const impl = fc.implementation;
    const filePath = path.join(dir, 'implementation.md');
    const lines: string[] = [`# ${Labels.implementation.title}`, ''];

    lines.push(`**${Labels.implementation.language}**: ${impl.language}`);
    if (impl.framework) lines.push(`**${Labels.implementation.framework}**: ${impl.framework}`);
    lines.push(`**${Labels.implementation.totalFiles}**: ${impl.totalFiles}`);
    lines.push(`**${Labels.implementation.totalLines}**: ${impl.totalLines}`);
    lines.push(`_${Labels.implementation.generatedBy}_`, '');

    // Summary table
    lines.push(`## ${Labels.implementation.summary}`, '');
    const sourceFiles = impl.files.filter(f => f.type === 'source');
    const testFiles = impl.files.filter(f => f.type === 'test');
    const configFiles = impl.files.filter(f => f.type === 'config');
    lines.push(`- ${Labels.implementation.sourceFiles}: ${sourceFiles.length}`);
    lines.push(`- ${Labels.implementation.testFiles}: ${testFiles.length}`);
    lines.push(`- ${Labels.implementation.configFiles}: ${configFiles.length}`, '');

    // Setup instructions
    if (impl.setupInstructions) {
      lines.push(`## ${Labels.implementation.setupInstructions}`, '');
      lines.push(impl.setupInstructions, '');
    }

    // Test commands
    if (impl.testCommands.length > 0) {
      lines.push(`## ${Labels.implementation.testCommands}`, '');
      for (const cmd of impl.testCommands) lines.push(`- \`${cmd}\``);
      lines.push('');
    }

    // File listing with descriptions
    for (const f of impl.files) {
      lines.push(`## ${f.path}`, '');
      lines.push(`_${Labels.implementation.fileType}: ${f.type} | ${Labels.implementation.language}: ${f.language}_`);
      if (f.description) lines.push(`\n${f.description}`);
      lines.push('');
      lines.push('```');
      lines.push(f.content);
      lines.push('```');
      lines.push('');
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);

    // Write individual implementation files
    const implDir = path.join(dir, 'implementation');
    ensureDirectory(implDir);

    for (const f of impl.files) {
      const targetPath = path.join(implDir, f.path);
      const targetDir = path.dirname(targetPath);
      ensureDirectory(targetDir);
      fs.writeFileSync(targetPath, f.content, 'utf-8');
    }
    this.logger.info(`Written ${impl.files.length} implementation files to: ${implDir}`);
  }

  private writeCoherence(dir: string, fc: FeatureContext): void {
    if (!fc.coherenceReport) return;
    const filePath = path.join(dir, 'coherence.md');
    const cr = fc.coherenceReport;
    const lines: string[] = ['# Relatório de Coerência', ''];

    lines.push(`**Score de Coerência**: ${cr.coherenceScore}%`, '');

    if (cr.uncoveredRequirements.length > 0) {
      lines.push('## Requisitos Sem Cobertura de Escopo', '');
      for (const r of cr.uncoveredRequirements) lines.push(`- ${r}`);
      lines.push('');
    }

    if (cr.scopeWithoutRequirement.length > 0) {
      lines.push('## Escopo Sem Requisito Justificador', '');
      for (const s of cr.scopeWithoutRequirement) lines.push(`- ${s}`);
      lines.push('');
    }

    if (cr.estimationGaps.length > 0) {
      lines.push('## Gaps na Estimativa', '');
      for (const g of cr.estimationGaps) lines.push(`- ${g}`);
      lines.push('');
    }

    if (cr.riskMismatch.length > 0) {
      lines.push('## Inconsistências de Risco', '');
      for (const r of cr.riskMismatch) lines.push(`- ${r}`);
      lines.push('');
    }

    if (cr.suggestions.length > 0) {
      lines.push('## Sugestões', '');
      for (const s of cr.suggestions) lines.push(`- ${s}`);
      lines.push('');
    }

    writeMarkdown(filePath, lines.join('\n'));
    this.logger.info(`Written: ${filePath}`);
  }

  private logPipelineSummary(result: PipelineResult): void {
    this.logger.info(`Pipeline ${result.sessionId}`);
    this.logger.info(`Feature: ${result.featureName}`);
    this.logger.info(`Duration: ${result.durationMs}ms`);
    this.logger.info(`Success: ${result.success}`);

    for (const s of result.steps) {
      const status = s.skipped ? 'SKIPPED' : s.success ? 'OK' : 'FAILED';
      const detail = s.error ? ` — ${s.error}` : '';
      this.logger.info(`  [${status}] ${s.stepName} ${s.agent} (${s.durationMs}ms)${detail}`);
    }

    if (result.warnings.length > 0) {
      for (const w of result.warnings) this.logger.warn(w);
    }

    if (result.errors.length > 0) {
      for (const e of result.errors) this.logger.error(e);
    }
  }
}
