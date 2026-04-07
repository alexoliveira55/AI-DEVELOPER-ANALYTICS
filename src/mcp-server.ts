#!/usr/bin/env node

/**
 * MCP Server entry point for AI Developer Analytics.
 *
 * Exposes the analysis pipeline as tools that GitHub Copilot Chat
 * can invoke via the Model Context Protocol (stdio transport).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as path from 'path';
import { loadConfig } from './config';
import { Orchestrator } from './orchestrator';
import { OutputGenerator } from './output';
import { Logger, RepositoryContextCache } from './core';
import { AnalysisDepth } from './types';

// Suppress all console/winston output — MCP uses stdout for JSON-RPC
Logger.silent = true;

/** Hard ceiling for MCP tool response text (bytes). Copilot rejects payloads above ~100 KB. */
const MAX_RESPONSE_SIZE = 64_000;

/** Max characters of source code to inline per file in the response. */
const MAX_FILE_PREVIEW = 2_000;

/** Max number of files whose preview is inlined. Beyond this, only the path list is shown. */
const MAX_INLINE_FILES = 8;

const server = new McpServer({
  name: 'ai-developer-analytics',
  version: '2.0.0',
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveProjectPath(projectPath?: string): string {
  return path.resolve(projectPath || process.cwd());
}

function formatSection(title: string, content: string | undefined): string {
  if (!content) return '';
  return `## ${title}\n\n${content}\n\n`;
}

/**
 * Truncate text to `maxLen` characters, appending an ellipsis note when trimmed.
 */
function truncateText(text: string, maxLen: number, tailNote?: string): string {
  if (text.length <= maxLen) return text;
  const note = tailNote ?? '... (truncado)';
  return text.slice(0, maxLen) + `\n${note}`;
}

/**
 * Build a compact summary for a list of generated files.
 * Inlines a limited preview for up to MAX_INLINE_FILES files, then lists paths only.
 */
function summarizeFiles(
  files: { path: string; content: string; description?: string }[],
  outputDir: string,
): string {
  const lines: string[] = [];
  lines.push(`**Arquivos gerados**: ${files.length}\n`);

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const lineCount = f.content.split('\n').length;

    if (i < MAX_INLINE_FILES) {
      lines.push(`### ${f.path} (${lineCount} linhas)\n`);
      if (f.description) lines.push(`_${f.description}_\n`);
      const preview = truncateText(f.content, MAX_FILE_PREVIEW, `... (truncado — ver arquivo completo em \`${outputDir}\`)`);
      lines.push('```');
      lines.push(preview);
      lines.push('```\n');
    } else {
      // Only list remaining files compactly
      if (i === MAX_INLINE_FILES) {
        lines.push(`### Demais arquivos (ver \`${outputDir}\`)\n`);
      }
      lines.push(`- \`${f.path}\` — ${lineCount} linhas${f.description ? ' — ' + f.description : ''}`);
    }
  }
  return lines.join('\n');
}

/**
 * Enforce the global response size limit. If the response exceeds MAX_RESPONSE_SIZE,
 * it is trimmed and a footer is appended directing the user to the output directory.
 */
function enforceResponseLimit(text: string, outputDir?: string): string {
  if (text.length <= MAX_RESPONSE_SIZE) return text;
  const footer = outputDir
    ? `\n\n---\n⚠️ Resposta truncada (${Math.round(text.length / 1024)} KB). Documentação completa em \`${outputDir}\`.`
    : `\n\n---\n⚠️ Resposta truncada (${Math.round(text.length / 1024)} KB).`;
  return text.slice(0, MAX_RESPONSE_SIZE - footer.length) + footer;
}

// ── Tool: analyze_repository ─────────────────────────────────────────────────

server.tool(
  'analyze_repository',
  'Analisa um repositório de software e retorna visão geral: linguagens, frameworks, arquitetura, endpoints, estrutura de banco de dados, histórico Git e projetos descobertos.',
  { projectPath: z.string().optional().describe('Caminho do repositório. Se omitido, usa o diretório atual.') },
  async ({ projectPath }) => {
    const resolved = resolveProjectPath(projectPath);
    const config = loadConfig();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.run({
      projectPath: resolved,
      config,
      mode: 'repository-only',
    });

    const fc = result.context;
    const lines: string[] = [];

    if (fc.repositoryContext) {
      const repo = fc.repositoryContext;
      lines.push('# Visão Geral do Repositório\n');
      lines.push(`**Projeto**: ${repo.meta.name}`);
      lines.push(`**Arquivos**: ${repo.meta.totalFiles} | **Linhas**: ${repo.meta.totalLines}`);
      lines.push(`**Arquitetura**: ${repo.architecturePattern.primary} (${repo.architecturePattern.patterns.join(', ')})\n`);

      if (repo.languages.length > 0) {
        lines.push('## Linguagens\n');
        lines.push('| Linguagem | Linhas | % |');
        lines.push('|---|---|---|');
        for (const l of repo.languages) {
          lines.push(`| ${l.language} | ${l.lines} | ${l.percentage}% |`);
        }
        lines.push('');
      }

      if (repo.frameworks.length > 0) {
        lines.push('## Frameworks\n');
        for (const f of repo.frameworks) {
          lines.push(`- **${f.name}** ${f.version} (${f.confidence})`);
        }
        lines.push('');
      }

      if (repo.services.length > 0) {
        lines.push(`## Serviços (${repo.services.length})\n`);
        for (const s of repo.services.slice(0, 15)) {
          lines.push(`- ${s.name} — ${s.methods.length} método(s) — \`${s.filePath}\``);
        }
        lines.push('');
      }

      if (repo.apiEndpoints.length > 0) {
        lines.push(`## Endpoints da API (${repo.apiEndpoints.length})\n`);
        lines.push('| Método | Rota |');
        lines.push('|---|---|');
        for (const ep of repo.apiEndpoints.slice(0, 20)) {
          lines.push(`| ${ep.method} | ${ep.route} |`);
        }
        lines.push('');
      }
    }

    if (fc.gitAnalysis) {
      lines.push('## Git\n');
      lines.push(`- Branch atual: **${fc.gitAnalysis.branchInfo.current}**`);
      lines.push(`- Commits recentes: ${fc.gitAnalysis.recentCommits.length}`);
      lines.push(`- Autores ativos: ${fc.gitAnalysis.activeAuthors.join(', ')}`);
      lines.push('');
    }

    if (fc.projectDiscovery && fc.projectDiscovery.projects.length > 0) {
      lines.push(`## Projetos Descobertos (${fc.projectDiscovery.projects.length})\n`);
      for (const p of fc.projectDiscovery.projects) {
        lines.push(`- **${p.name}** (${p.language}${p.framework ? '/' + p.framework : ''}) — \`${p.path}\``);
      }
      lines.push('');
    }

    const repoResponse = enforceResponseLimit(lines.join('\n'));
    return { content: [{ type: 'text' as const, text: repoResponse }] };
  },
);

// ── Tool: generate_requirements ──────────────────────────────────────────────

server.tool(
  'generate_requirements',
  'Gera análise de requisitos funcionais e não-funcionais a partir de uma descrição de funcionalidade, considerando o contexto do repositório.',
  {
    description: z.string().describe('Descrição da funcionalidade ou necessidade de negócio'),
    projectPath: z.string().optional().describe('Caminho do repositório. Se omitido, usa o diretório atual.'),
  },
  async ({ description, projectPath }) => {
    const resolved = resolveProjectPath(projectPath);
    const config = loadConfig();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.run({
      projectPath: resolved,
      config,
      requirements: description,
    });

    const fc = result.context;
    const lines: string[] = [`# Análise de Requisitos: ${description}\n`];

    if (fc.requirementsAnalysis) {
      const req = fc.requirementsAnalysis;
      if (req.functionalRequirements.length > 0) {
        lines.push('## Requisitos Funcionais\n');
        for (const r of req.functionalRequirements) {
          lines.push(`- **${r.id}** [${r.priority}] (${r.category}) ${r.description}`);
        }
        lines.push('');
      }
      if (req.nonFunctionalRequirements.length > 0) {
        lines.push('## Requisitos Não Funcionais\n');
        for (const r of req.nonFunctionalRequirements) {
          lines.push(`- **${r.id}** [${r.priority}] (${r.category}) ${r.description}`);
        }
        lines.push('');
      }
      if (req.assumptions.length > 0) {
        lines.push('## Premissas\n');
        for (const a of req.assumptions) lines.push(`- ${a}`);
        lines.push('');
      }
      if (req.constraints.length > 0) {
        lines.push('## Restrições\n');
        for (const c of req.constraints) lines.push(`- ${c}`);
        lines.push('');
      }
    }

    if (fc.scopeDefinition) {
      lines.push(`## Escopo\n`);
      lines.push(`**Complexidade**: ${fc.scopeDefinition.estimatedComplexity}\n`);
      if (fc.scopeDefinition.inScope.length > 0) {
        lines.push('### Dentro do Escopo\n');
        for (const s of fc.scopeDefinition.inScope) {
          lines.push(`- [${s.type}] **${s.area}** — ${s.description}`);
        }
        lines.push('');
      }
    }

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
);

// ── Tool: generate_full_analysis ─────────────────────────────────────────────

server.tool(
  'generate_full_analysis',
  'Executa o pipeline completo de análise: requisitos, escopo, solução, impacto, estimativa e documentação. Salva os artefatos em docs/features/.',
  {
    description: z.string().describe('Descrição da funcionalidade'),
    projectPath: z.string().optional().describe('Caminho do repositório'),
    depth: z.enum(['quick', 'standard', 'deep']).optional().describe('Profundidade da análise: quick (rápida), standard (padrão), deep (completa)'),
    enableFlowcharts: z.boolean().optional().describe('Gerar fluxogramas Mermaid'),
    enableSpecialists: z.boolean().optional().describe('Ativar especialistas por linguagem'),
    enableExecutiveDocs: z.boolean().optional().describe('Gerar documentação técnica e executiva'),
    enableImplementation: z.boolean().optional().describe('Gerar código de implementação como desenvolvedor senior'),
  },
  async ({ description, projectPath, depth, enableFlowcharts, enableSpecialists, enableExecutiveDocs, enableImplementation }) => {
    const resolved = resolveProjectPath(projectPath);
    const config = loadConfig();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.run({
      projectPath: resolved,
      config,
      requirements: description,
      depth: (depth as AnalysisDepth) ?? 'standard',
      enableFlowcharts: enableFlowcharts ?? true,
      enableSpecialists: enableSpecialists ?? false,
      enableExecutiveDocs: enableExecutiveDocs ?? true,
      enableImplementation: enableImplementation ?? false,
    });

    // Write output files
    const outputGen = new OutputGenerator();
    const outputDir = outputGen.write(result, resolved);

    const fc = result.context;
    const lines: string[] = [`# Análise Completa: ${description}\n`];
    lines.push(`_Artefatos salvos em: \`${outputDir}\`_\n`);

    // Summary
    lines.push('## Resumo\n');
    const steps = result.steps;
    const ok = steps.filter((s) => s.success && !s.skipped).length;
    const fail = steps.filter((s) => !s.success).length;
    const skip = steps.filter((s) => s.skipped).length;
    lines.push(`- **${ok}** etapas concluídas, **${fail}** falhas, **${skip}** ignoradas`);
    lines.push(`- Duração total: ${result.durationMs}ms\n`);

    // Key results inline
    if (fc.scopeDefinition) {
      lines.push(`**Complexidade**: ${fc.scopeDefinition.estimatedComplexity}`);
      lines.push(`**Novos módulos**: ${fc.scopeDefinition.newModules.length}`);
      lines.push(`**Módulos afetados**: ${fc.scopeDefinition.affectedModules.length}\n`);
    }

    if (fc.estimation) {
      const est = fc.estimation;
      lines.push(`**Estimativa**: ${est.totalHours}h (confiança: ${est.confidence})`);
      if (est.storyPoints) lines.push(`**Story Points**: ${est.storyPoints}`);
      lines.push('');

      if (est.scenarios) {
        lines.push('### Cenários\n');
        lines.push('| Cenário | Horas | Dias |');
        lines.push('|---|---|---|');
        lines.push(`| Humano | ${est.scenarios.human.hours}h | ${est.scenarios.human.days}d |`);
        lines.push(`| Com Copilot (${est.scenarios.withCopilot.gain}) | ${est.scenarios.withCopilot.hours}h | ${est.scenarios.withCopilot.days}d |`);
        lines.push(`| Híbrido (${est.scenarios.hybrid.gain}) | ${est.scenarios.hybrid.hours}h | ${est.scenarios.hybrid.days}d |`);
        lines.push('');
      }

      if (est.breakdown.length > 0) {
        lines.push('### Detalhamento\n');
        lines.push('| Tarefa | Horas | Complexidade |');
        lines.push('|---|---|---|');
        for (const b of est.breakdown) {
          lines.push(`| ${b.task} | ${b.hours}h | ${b.complexity} |`);
        }
        lines.push('');
      }
    }

    if (fc.impactAnalysis) {
      lines.push(`**Risco**: ${fc.impactAnalysis.riskLevel}\n`);
      if (fc.impactAnalysis.breakingChanges.length > 0) {
        lines.push('### Mudanças com Quebra\n');
        for (const bc of fc.impactAnalysis.breakingChanges) lines.push(`- ⚠️ ${bc}`);
        lines.push('');
      }
    }

    if (fc.solutionArchitecture) {
      lines.push('## Componentes Propostos\n');
      lines.push('| Componente | Tipo | Novo? | Descrição |');
      lines.push('|---|---|---|---|');
      for (const c of fc.solutionArchitecture.proposedComponents) {
        lines.push(`| ${c.name} | ${c.type} | ${c.isNew ? 'Sim' : 'Não'} | ${c.description} |`);
      }
      lines.push('');
    }

    if (fc.documentationPackage?.summary) {
      lines.push(truncateText(fc.documentationPackage.summary, 4_000, '... (documentação truncada — ver artefatos em disco)'));
    }

    // ── Coherence Report ─────────────────────────────────
    if (fc.coherenceReport) {
      const cr = fc.coherenceReport;
      lines.push(`## Coerência da Análise\n`);
      lines.push(`**Score**: ${cr.coherenceScore}%\n`);
      if (cr.uncoveredRequirements.length > 0) {
        lines.push('### Requisitos sem cobertura de escopo\n');
        for (const r of cr.uncoveredRequirements) lines.push(`- ${r}`);
        lines.push('');
      }
      if (cr.scopeWithoutRequirement.length > 0) {
        lines.push('### Escopo sem requisito justificador\n');
        for (const s of cr.scopeWithoutRequirement) lines.push(`- ${s}`);
        lines.push('');
      }
      if (cr.estimationGaps.length > 0) {
        lines.push('### Gaps na estimativa\n');
        for (const g of cr.estimationGaps) lines.push(`- ${g}`);
        lines.push('');
      }
      if (cr.suggestions.length > 0) {
        lines.push('### Sugestões\n');
        for (const s of cr.suggestions) lines.push(`- ${s}`);
        lines.push('');
      }
    }

    lines.push(`\n---\n_Documentação completa em \`${outputDir}\`_`);

    const fullResponse = enforceResponseLimit(lines.join('\n'), outputDir);
    return { content: [{ type: 'text' as const, text: fullResponse }] };
  },
);

// ── Tool: estimate_effort ────────────────────────────────────────────────────

server.tool(
  'estimate_effort',
  'Estima o esforço em horas para implementar uma funcionalidade, com breakdown por tarefa e nível de confiança.',
  {
    description: z.string().describe('Descrição da funcionalidade'),
    projectPath: z.string().optional().describe('Caminho do repositório'),
    depth: z.enum(['quick', 'standard', 'deep']).optional().describe('Profundidade: quick (rápida), standard (padrão), deep (completa)'),
  },
  async ({ description, projectPath, depth }) => {
    const resolved = resolveProjectPath(projectPath);
    const config = loadConfig();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.run({
      projectPath: resolved,
      config,
      requirements: description,
      depth: (depth as AnalysisDepth) ?? 'standard',
    });

    const fc = result.context;
    const lines: string[] = [`# Estimativa: ${description}\n`];

    if (fc.estimation) {
      const est = fc.estimation;
      lines.push(`**Total**: ${est.totalHours}h`);
      lines.push(`**Confiança**: ${est.confidence}`);
      if (est.storyPoints) lines.push(`**Story Points**: ${est.storyPoints}`);
      lines.push('');

      if (est.scenarios) {
        lines.push('## Cenários de Estimativa\n');
        lines.push('| Cenário | Horas | Dias |');
        lines.push('|---|---|---|');
        lines.push(`| Desenvolvimento Humano | ${est.scenarios.human.hours}h | ${est.scenarios.human.days}d |`);
        lines.push(`| Com GitHub Copilot (-${est.scenarios.withCopilot.gain}) | ${est.scenarios.withCopilot.hours}h | ${est.scenarios.withCopilot.days}d |`);
        lines.push(`| Abordagem Híbrida (-${est.scenarios.hybrid.gain}) | ${est.scenarios.hybrid.hours}h | ${est.scenarios.hybrid.days}d |`);
        lines.push('');
      }

      if (est.breakdown.length > 0) {
        lines.push('## Detalhamento\n');
        lines.push('| Tarefa | Horas | Complexidade |');
        lines.push('|---|---|---|');
        for (const b of est.breakdown) {
          lines.push(`| ${b.task} | ${b.hours}h | ${b.complexity} |`);
        }
        lines.push('');
      }

      if (est.suggestedTimeline && est.suggestedTimeline.length > 0) {
        lines.push('## Cronograma Sugerido\n');
        lines.push('| Fase | Dias | Paralelizável |');
        lines.push('|---|---|---|');
        for (const tp of est.suggestedTimeline) {
          lines.push(`| ${tp.phase} | ${tp.days}d | ${tp.parallelizable ? 'Sim' : 'Não'} |`);
        }
        lines.push('');
      }

      if (est.estimationRisks && est.estimationRisks.length > 0) {
        lines.push('## Riscos da Estimativa\n');
        for (const r of est.estimationRisks) {
          const direction = r.impact === 'increase' ? '↑' : '↓';
          lines.push(`- ${direction} ${r.risk} (fator: ${r.factor}x)`);
        }
        lines.push('');
      }
    } else {
      lines.push('_Não foi possível gerar estimativa._');
    }

    if (fc.impactAnalysis) {
      lines.push(`**Risco**: ${fc.impactAnalysis.riskLevel}\n`);
    }

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
);

// ── Tool: generate_solution ──────────────────────────────────────────────────

server.tool(
  'generate_solution',
  'Gera a arquitetura da solução com componentes propostos, integrações, fluxo de dados e stack tecnológico.',
  {
    description: z.string().describe('Descrição da funcionalidade'),
    projectPath: z.string().optional().describe('Caminho do repositório'),
  },
  async ({ description, projectPath }) => {
    const resolved = resolveProjectPath(projectPath);
    const config = loadConfig();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.run({
      projectPath: resolved,
      config,
      requirements: description,
      enableFlowcharts: true,
    });

    const fc = result.context;
    const lines: string[] = [`# Arquitetura da Solução: ${description}\n`];

    if (fc.solutionArchitecture) {
      const sol = fc.solutionArchitecture;
      lines.push(sol.overview + '\n');

      if (sol.proposedComponents.length > 0) {
        lines.push('## Componentes\n');
        lines.push('| Componente | Tipo | Novo? | Descrição |');
        lines.push('|---|---|---|---|');
        for (const c of sol.proposedComponents) {
          lines.push(`| ${c.name} | ${c.type} | ${c.isNew ? 'Sim' : 'Não'} | ${c.description} |`);
        }
        lines.push('');
      }

      if (sol.integrations.length > 0) {
        lines.push('## Integrações\n');
        for (const i of sol.integrations) {
          lines.push(`- **${i.source}** → **${i.target}** (${i.type}): ${i.description}`);
        }
        lines.push('');
      }

      if (sol.dataFlows.length > 0) {
        lines.push('## Fluxo de Dados\n');
        for (const df of sol.dataFlows) {
          lines.push(`- **${df.from}** → **${df.to}**: ${df.data} — ${df.description}`);
        }
        lines.push('');
      }

      if (sol.technologyStack.length > 0) {
        lines.push('## Stack Tecnológico\n');
        for (const t of sol.technologyStack) lines.push(`- ${t}`);
        lines.push('');
      }
    }

    if (fc.flowcharts && fc.flowcharts.length > 0) {
      lines.push('## Diagramas\n');
      for (const chart of fc.flowcharts) {
        lines.push(`### ${chart.title}\n`);
        lines.push(chart.description + '\n');
        lines.push('```mermaid');
        lines.push(truncateText(chart.mermaidCode, 3_000, '%% ... (diagrama truncado)'));
        lines.push('```\n');
      }
    }

    const solResponse = enforceResponseLimit(lines.join('\n'));
    return { content: [{ type: 'text' as const, text: solResponse }] };
  },
);

// ── Tool: generate_prototype ─────────────────────────────────────────────────

server.tool(
  'generate_prototype',
  'Gera protótipo interativo (HTML/Angular/Flutter/.NET) com formulários, tabelas, validação e tema claro/escuro.',
  {
    description: z.string().describe('Descrição da funcionalidade para prototipagem'),
    projectPath: z.string().optional().describe('Caminho do repositório (detecta framework automaticamente)'),
  },
  async ({ description, projectPath }) => {
    const resolved = resolveProjectPath(projectPath);
    const config = loadConfig();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.run({
      projectPath: resolved,
      config,
      requirements: description,
      generatePrototype: true,
    });

    const fc = result.context;
    const lines: string[] = [`# Protótipo: ${description}\n`];

    // Write output files
    const outputGen = new OutputGenerator();
    const outputDir = outputGen.write(result, resolved);
    lines.push(`_Artefatos salvos em: \`${outputDir}\`_\n`);

    if (fc.richPrototype) {
      const proto = fc.richPrototype;
      lines.push(`**Framework**: ${proto.framework}`);
      lines.push(`**Responsivo**: ${proto.responsive ? 'Sim' : 'Não'}`);
      lines.push(`**Interativo**: ${proto.interactive ? 'Sim' : 'Não'}`);
      lines.push(`**Ponto de entrada**: \`${proto.entryPoint}\`\n`);
      lines.push(summarizeFiles(proto.files, outputDir));
    } else if (fc.prototype) {
      lines.push(summarizeFiles(fc.prototype.files, outputDir));
    } else {
      lines.push('_Não foi possível gerar o protótipo._');
    }

    const protoResponse = enforceResponseLimit(lines.join('\n'), outputDir);
    return { content: [{ type: 'text' as const, text: protoResponse }] };
  },
);

// ── Tool: generate_implementation ────────────────────────────────────────────

server.tool(
  'generate_implementation',
  'Gera código production-ready como um desenvolvedor senior. Suporta Angular, C#/.NET, Python, SQL, Flutter/Dart, Web, Visual FoxPro e genérico.',
  {
    description: z.string().describe('Descrição da funcionalidade a ser implementada'),
    projectPath: z.string().optional().describe('Caminho do repositório. Se omitido, usa o diretório atual.'),
    targetLanguage: z.string().optional().describe('Linguagem/framework alvo (angular, csharp, python, sql, flutter, web, vfp). Se omitido, detecta automaticamente.'),
  },
  async ({ description, projectPath, targetLanguage }) => {
    const resolved = resolveProjectPath(projectPath);
    const config = loadConfig();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.run({
      projectPath: resolved,
      config,
      requirements: description,
      depth: 'standard',
      enableSpecialists: true,
      enableImplementation: true,
    });

    // Write output files
    const outputGen = new OutputGenerator();
    const outputDir = outputGen.write(result, resolved);

    const fc = result.context;
    const lines: string[] = [`# Implementação: ${description}\n`];
    lines.push(`_Artefatos salvos em: \`${outputDir}\`_\n`);

    if (fc.implementation) {
      const impl = fc.implementation;
      lines.push(`**Linguagem**: ${impl.language}`);
      if (impl.framework) lines.push(`**Framework**: ${impl.framework}`);
      lines.push(`**Arquivos gerados**: ${impl.totalFiles}`);
      lines.push(`**Total de linhas**: ${impl.totalLines}\n`);

      if (impl.setupInstructions) {
        lines.push('## Instruções de Setup\n');
        lines.push(impl.setupInstructions + '\n');
      }

      if (impl.testCommands.length > 0) {
        lines.push('## Comandos de Teste\n');
        for (const cmd of impl.testCommands) lines.push(`- \`${cmd}\``);
        lines.push('');
      }

      lines.push('## Arquivos\n');
      lines.push(summarizeFiles(impl.files, outputDir));
    } else {
      lines.push('_Não foi possível gerar a implementação._');
    }

    lines.push(`\n---\n_Código completo em \`${outputDir}\`_`);

    const implResponse = enforceResponseLimit(lines.join('\n'), outputDir);
    return { content: [{ type: 'text' as const, text: implResponse }] };
  },
);

// ── Tool: health_check ───────────────────────────────────────────────────────

server.tool(
  'health_check',
  'Verifica o status do servidor MCP, cache e configuração. Útil para diagnóstico.',
  {},
  async () => {
    const config = loadConfig();
    const cache = Orchestrator.cache;
    const lines: string[] = ['# Health Check\n'];
    lines.push(`- **Status**: OK`);
    lines.push(`- **Modo de execução**: ${config.executionMode ?? 'auto'}`);
    lines.push(`- **Provider AI**: ${config.ai?.provider ?? 'nenhum'}`);
    lines.push(`- **Modelo**: ${config.ai?.model ?? 'nenhum'}`);
    lines.push(`- **Cache ativo**: ${cache.size > 0 ? `Sim (${cache.size} entrada(s))` : 'Não'}`);
    lines.push(`- **Idioma**: ${config.language ?? 'pt-BR'}`);
    if (config.estimation) {
      lines.push('- **Configuração de estimativa**:');
      lines.push(`  - Focus Factor: ${config.estimation.focusFactor ?? 0.7}`);
      lines.push(`  - Horas/SP: ${config.estimation.hoursPerStoryPoint ?? 6}`);
      lines.push(`  - Copilot Gain: ${config.estimation.copilotGain ?? 0.35}`);
      lines.push(`  - Team Size: ${config.estimation.teamSize ?? 1}`);
      lines.push(`  - Seniority: ${config.estimation.seniorityLevel ?? 'mid'}`);
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
);

// ── Tool: invalidate_cache ───────────────────────────────────────────────────

server.tool(
  'invalidate_cache',
  'Invalida o cache do repositório para forçar re-análise na próxima execução.',
  {
    projectPath: z.string().optional().describe('Caminho do repositório para invalidar. Se omitido, limpa todo o cache.'),
  },
  async ({ projectPath }) => {
    const cache = Orchestrator.cache;
    if (projectPath) {
      const resolved = resolveProjectPath(projectPath);
      cache.invalidate(resolved);
      return { content: [{ type: 'text' as const, text: `Cache invalidado para: ${resolved}` }] };
    }
    cache.invalidateAll();
    return { content: [{ type: 'text' as const, text: 'Todo o cache foi limpo.' }] };
  },
);

// ── Tool: what_if_analysis ───────────────────────────────────────────────────

server.tool(
  'what_if_analysis',
  'Executa análise comparativa "e se?" — compara estimativas com diferentes profundidades (quick vs deep) para uma funcionalidade.',
  {
    description: z.string().describe('Descrição da funcionalidade'),
    projectPath: z.string().optional().describe('Caminho do repositório'),
  },
  async ({ description, projectPath }) => {
    const resolved = resolveProjectPath(projectPath);
    const config = loadConfig();

    // Run quick analysis
    const quickOrch = new Orchestrator();
    const quickResult = await quickOrch.run({
      projectPath: resolved, config, requirements: description, depth: 'quick',
    });

    // Run standard analysis
    const stdOrch = new Orchestrator();
    const stdResult = await stdOrch.run({
      projectPath: resolved, config, requirements: description, depth: 'standard',
    });

    const lines: string[] = [`# Análise "E Se?": ${description}\n`];
    const qEst = quickResult.context.estimation;
    const sEst = stdResult.context.estimation;

    lines.push('## Comparação\n');
    lines.push('| Métrica | Quick | Standard |');
    lines.push('|---|---|---|');
    lines.push(`| Total Horas | ${qEst?.totalHours ?? '-'}h | ${sEst?.totalHours ?? '-'}h |`);
    lines.push(`| Story Points | ${qEst?.storyPoints ?? '-'} | ${sEst?.storyPoints ?? '-'} |`);
    lines.push(`| Confiança | ${qEst?.confidence ?? '-'} | ${sEst?.confidence ?? '-'} |`);
    lines.push(`| Tarefas | ${qEst?.breakdown.length ?? 0} | ${sEst?.breakdown.length ?? 0} |`);
    lines.push(`| Duração Pipeline | ${quickResult.durationMs}ms | ${stdResult.durationMs}ms |`);
    lines.push('');

    if (sEst?.scenarios) {
      lines.push('## Cenários (Standard)\n');
      lines.push('| Cenário | Horas | Dias |');
      lines.push('|---|---|---|');
      lines.push(`| Humano | ${sEst.scenarios.human.hours}h | ${sEst.scenarios.human.days}d |`);
      lines.push(`| Copilot | ${sEst.scenarios.withCopilot.hours}h | ${sEst.scenarios.withCopilot.days}d |`);
      lines.push(`| Híbrido | ${sEst.scenarios.hybrid.hours}h | ${sEst.scenarios.hybrid.days}d |`);
      lines.push('');
    }

    const qReq = quickResult.context.requirementsAnalysis;
    const sReq = stdResult.context.requirementsAnalysis;
    if (qReq || sReq) {
      lines.push('## Requisitos Identificados\n');
      lines.push(`| Tipo | Quick | Standard |`);
      lines.push('|---|---|---|');
      lines.push(`| Funcionais | ${qReq?.functionalRequirements.length ?? 0} | ${sReq?.functionalRequirements.length ?? 0} |`);
      lines.push(`| Não Funcionais | ${qReq?.nonFunctionalRequirements.length ?? 0} | ${sReq?.nonFunctionalRequirements.length ?? 0} |`);
      lines.push('');
    }

    if (stdResult.context.coherenceReport) {
      lines.push(`## Coerência (Standard)\n`);
      lines.push(`**Score**: ${stdResult.context.coherenceReport.coherenceScore}%\n`);
    }

    const whatIfResponse = enforceResponseLimit(lines.join('\n'));
    return { content: [{ type: 'text' as const, text: whatIfResponse }] };
  },
);

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`MCP Server error: ${err}\n`);
  process.exit(1);
});
