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
import { Logger } from './core';

// Suppress all console/winston output — MCP uses stdout for JSON-RPC
Logger.silent = true;

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

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
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
    enableFlowcharts: z.boolean().optional().describe('Gerar fluxogramas Mermaid'),
    enableSpecialists: z.boolean().optional().describe('Ativar especialistas por linguagem'),
    enableExecutiveDocs: z.boolean().optional().describe('Gerar documentação técnica e executiva'),
  },
  async ({ description, projectPath, enableFlowcharts, enableSpecialists, enableExecutiveDocs }) => {
    const resolved = resolveProjectPath(projectPath);
    const config = loadConfig();
    const orchestrator = new Orchestrator();

    const result = await orchestrator.run({
      projectPath: resolved,
      config,
      requirements: description,
      enableFlowcharts: enableFlowcharts ?? true,
      enableSpecialists: enableSpecialists ?? false,
      enableExecutiveDocs: enableExecutiveDocs ?? true,
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
      lines.push(`**Estimativa**: ${fc.estimation.totalHours}h (confiança: ${fc.estimation.confidence})\n`);
      if (fc.estimation.breakdown.length > 0) {
        lines.push('| Tarefa | Horas | Complexidade |');
        lines.push('|---|---|---|');
        for (const b of fc.estimation.breakdown) {
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
      lines.push(fc.documentationPackage.summary);
    }

    lines.push(`\n---\n_Documentação completa em \`${outputDir}\`_`);

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
);

// ── Tool: estimate_effort ────────────────────────────────────────────────────

server.tool(
  'estimate_effort',
  'Estima o esforço em horas para implementar uma funcionalidade, com breakdown por tarefa e nível de confiança.',
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
    });

    const fc = result.context;
    const lines: string[] = [`# Estimativa: ${description}\n`];

    if (fc.estimation) {
      const est = fc.estimation;
      lines.push(`**Total**: ${est.totalHours}h`);
      lines.push(`**Confiança**: ${est.confidence}\n`);

      if (est.breakdown.length > 0) {
        lines.push('| Tarefa | Horas | Complexidade |');
        lines.push('|---|---|---|');
        for (const b of est.breakdown) {
          lines.push(`| ${b.task} | ${b.hours}h | ${b.complexity} |`);
        }
        lines.push('');
      }

      const totalDays = Math.ceil(est.totalHours / 8);
      lines.push('## Cronograma Sugerido\n');
      lines.push(`| Fase | Dias |`);
      lines.push('|---|---|');
      lines.push(`| Análise | ${Math.ceil(totalDays * 0.15)} |`);
      lines.push(`| Desenvolvimento | ${Math.ceil(totalDays * 0.50)} |`);
      lines.push(`| Testes | ${Math.ceil(totalDays * 0.25)} |`);
      lines.push(`| Deploy | ${Math.ceil(totalDays * 0.10)} |`);
      lines.push('');
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
        lines.push(chart.mermaidCode);
        lines.push('```\n');
      }
    }

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
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

    if (fc.richPrototype) {
      const proto = fc.richPrototype;
      lines.push(`**Framework**: ${proto.framework}`);
      lines.push(`**Responsivo**: ${proto.responsive ? 'Sim' : 'Não'}`);
      lines.push(`**Interativo**: ${proto.interactive ? 'Sim' : 'Não'}`);
      lines.push(`**Ponto de entrada**: \`${proto.entryPoint}\`\n`);
      lines.push(`**Arquivos gerados** (${proto.files.length}):\n`);
      for (const f of proto.files) {
        lines.push(`### ${f.path}\n`);
        lines.push('```');
        lines.push(f.content);
        lines.push('```\n');
      }
    } else if (fc.prototype) {
      for (const f of fc.prototype.files) {
        lines.push(`### ${f.path}\n`);
        lines.push('```');
        lines.push(f.content);
        lines.push('```\n');
      }
    } else {
      lines.push('_Não foi possível gerar o protótipo._');
    }

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
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
