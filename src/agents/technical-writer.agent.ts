import { BaseAgent } from '../core';
import { Labels } from '../config';
import { AgentRole, FeatureContext, SessionContext } from '../types';

/**
 * Generates technical documentation targeting senior developers and analysts.
 * Produces detailed architecture, data model, API contracts, and decision records.
 */
export class TechnicalWriterAgent extends BaseAgent<FeatureContext, string> {
  readonly role = AgentRole.TechnicalWriter;
  readonly name = 'Technical Writer';

  protected async run(fc: FeatureContext, ctx: SessionContext): Promise<string> {
    return this.withLlmFallback(
      () => this.llmGenerate(fc, ctx),
      () => this.offlineGenerate(fc),
    );
  }

  private async llmGenerate(_fc: FeatureContext, _ctx: SessionContext): Promise<string> {
    return this.offlineGenerate(_fc);
  }

  private async offlineGenerate(fc: FeatureContext): Promise<string> {
    const lines: string[] = [];
    const feature = fc.rawRequirements ?? 'Funcionalidade';

    lines.push(`# Documentação Técnica: ${feature}`, '');
    lines.push(`_${Labels.common.generatedAt}: ${new Date().toLocaleDateString('pt-BR')}_`, '');

    // Table of contents
    lines.push('## Índice', '');
    lines.push('1. [Visão Geral Técnica](#visão-geral-técnica)');
    lines.push('2. [Arquitetura](#arquitetura)');
    lines.push('3. [Modelo de Dados](#modelo-de-dados)');
    lines.push('4. [APIs](#apis)');
    lines.push('5. [Análise de Impacto](#análise-de-impacto)');
    lines.push('6. [Estimativas](#estimativas)');
    lines.push('7. [Decisões Técnicas](#decisões-técnicas)');
    lines.push('');

    // 1. Overview
    lines.push('## Visão Geral Técnica', '');
    if (fc.solutionArchitecture) {
      lines.push(fc.solutionArchitecture.overview, '');
    } else {
      lines.push('_Informações da solução não disponíveis._', '');
    }

    // 2. Architecture
    lines.push('## Arquitetura', '');
    if (fc.solutionArchitecture) {
      const sol = fc.solutionArchitecture;
      if (sol.proposedComponents.length > 0) {
        lines.push('### Componentes Propostos', '');
        lines.push(`| ${Labels.common.component} | ${Labels.common.type} | Novo? | ${Labels.common.description} |`);
        lines.push('|---|---|---|---|');
        for (const c of sol.proposedComponents) {
          lines.push(`| ${c.name} | ${c.type} | ${c.isNew ? 'Sim' : 'Não'} | ${c.description} |`);
        }
        lines.push('');
      }
      if (sol.technologyStack.length > 0) {
        lines.push('### Stack Tecnológico', '');
        for (const t of sol.technologyStack) lines.push(`- ${t}`);
        lines.push('');
      }
      if (sol.integrations.length > 0) {
        lines.push('### Integrações', '');
        for (const i of sol.integrations) {
          lines.push(`- **${i.source}** → **${i.target}** (${i.type}): ${i.description}`);
        }
        lines.push('');
      }
    }

    // 3. Data Model
    lines.push('## Modelo de Dados', '');
    if (fc.databaseSummary) {
      lines.push('Banco de dados disponível no contexto da análise. Ver `feature-context.json` para detalhes.', '');
    }
    if (fc.scopeDefinition) {
      const dbItems = fc.scopeDefinition.inScope.filter((s) =>
        s.description.toLowerCase().includes('banco') || s.description.toLowerCase().includes('migra'),
      );
      if (dbItems.length > 0) {
        for (const item of dbItems) lines.push(`- ${item.description}`);
        lines.push('');
      }
    }

    // 4. APIs
    lines.push('## APIs', '');
    if (fc.solutionArchitecture) {
      const controllers = fc.solutionArchitecture.proposedComponents.filter((c) => c.type === 'controller');
      if (controllers.length > 0) {
        for (const ctrl of controllers) {
          lines.push(`### ${ctrl.name}`, '');
          lines.push(ctrl.description, '');
        }
      }
    }
    if (fc.repositoryContext) {
      const endpoints = fc.repositoryContext.apiEndpoints;
      if (endpoints.length > 0) {
        lines.push('### Endpoints Existentes Relevantes', '');
        lines.push('| Método | Rota | Controlador |');
        lines.push('|---|---|---|');
        for (const ep of endpoints.slice(0, 20)) {
          lines.push(`| ${ep.method} | ${ep.route} | ${ep.handler} |`);
        }
        lines.push('');
      }
    }

    // 5. Impact
    lines.push('## Análise de Impacto', '');
    if (fc.impactAnalysis) {
      const impact = fc.impactAnalysis;
      lines.push(`**Nível de Risco**: ${impact.riskLevel}`, '');
      if (impact.breakingChanges.length > 0) {
        lines.push('### Mudanças com Quebra', '');
        for (const bc of impact.breakingChanges) lines.push(`- ⚠️ ${bc}`);
        lines.push('');
      }
      if (impact.testingRecommendations.length > 0) {
        lines.push('### Recomendações de Teste', '');
        for (const t of impact.testingRecommendations) lines.push(`- ${t}`);
        lines.push('');
      }
    }

    // 6. Estimation
    lines.push('## Estimativas', '');
    if (fc.estimation) {
      const est = fc.estimation;
      lines.push(`**Total**: ${est.totalHours}h | **Confiança**: ${est.confidence}`, '');
      if (est.breakdown.length > 0) {
        lines.push(`| Tarefa | Horas | Complexidade |`);
        lines.push('|---|---|---|');
        for (const item of est.breakdown) {
          lines.push(`| ${item.task} | ${item.hours}h | ${item.complexity} |`);
        }
        lines.push('');
      }
    }

    // 7. Technical Decisions
    lines.push('## Decisões Técnicas', '');
    if (fc.repositoryContext) {
      const arch = fc.repositoryContext.architecturePattern;
      lines.push(`- Arquitetura: ${arch.primary} (${arch.patterns.join(', ')})`);
    }
    if (fc.reuseAnalysis && fc.reuseAnalysis.candidates.length > 0) {
      lines.push(`- Reuso: ${fc.reuseAnalysis.candidates.length} componente(s) reutilizável(is) identificado(s) (score: ${fc.reuseAnalysis.reuseScore}%)`);
    }
    lines.push('');

    return lines.join('\n');
  }
}
