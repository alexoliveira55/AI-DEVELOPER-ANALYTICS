import { BaseAgent } from '../core';
import { AgentRole, FeatureContext, SessionContext } from '../types';

/**
 * Generates executive documentation targeting POs, managers and non-technical stakeholders.
 * Uses business language—no technical jargon like API, endpoint, controller, etc.
 */
export class ExecutiveWriterAgent extends BaseAgent<FeatureContext, string> {
  readonly role = AgentRole.ExecutiveWriter;
  readonly name = 'Executive Writer';

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

    lines.push(`# Documento Executivo: ${feature}`, '');
    lines.push(`_Gerado em: ${new Date().toLocaleDateString('pt-BR')}_`, '');

    // 1. Executive Summary
    lines.push('## Resumo Executivo', '');
    lines.push(`Esta análise descreve a implementação da funcionalidade **${feature}**.`, '');

    if (fc.scopeDefinition) {
      const scope = fc.scopeDefinition;
      const newCount = scope.newModules.length;
      const affectedCount = scope.affectedModules.length;
      lines.push(`- **${newCount}** novo(s) módulo(s) será(ão) criado(s)`);
      lines.push(`- **${affectedCount}** módulo(s) existente(s) será(ão) impactado(s)`);
      lines.push(`- Complexidade estimada: **${scope.estimatedComplexity}**`);
      lines.push('');
    }

    // 2. Scope in Business Language
    lines.push('## Escopo em Linguagem de Negócio', '');
    if (fc.requirementsAnalysis) {
      for (const req of fc.requirementsAnalysis.functionalRequirements) {
        lines.push(`- O sistema permitirá que: ${req.description}`);
      }
      lines.push('');
    }

    // 3. Business Impact
    lines.push('## Impacto no Negócio', '');
    if (fc.impactAnalysis) {
      for (const area of fc.impactAnalysis.impactedAreas) {
        // Translate technical area names to business language
        const businessName = area.area
          .replace(/controller/gi, 'módulo de interface')
          .replace(/service/gi, 'módulo de regras')
          .replace(/repository/gi, 'módulo de dados')
          .replace(/middleware/gi, 'camada de processamento');
        lines.push(`- **${businessName}** (impacto: ${area.impact}): ${area.description}`);
      }
      lines.push('');
    }

    // 4. Simplified Schedule
    lines.push('## Cronograma Simplificado', '');
    if (fc.estimation) {
      const totalDays = Math.ceil(fc.estimation.totalHours / 8);
      lines.push(`**Estimativa total**: ${totalDays} dia(s) útil(eis)`, '');

      lines.push('| Fase | Estimativa |');
      lines.push('|---|---|');
      lines.push(`| Análise e planejamento | ${Math.ceil(totalDays * 0.15)} dia(s) |`);
      lines.push(`| Desenvolvimento | ${Math.ceil(totalDays * 0.50)} dia(s) |`);
      lines.push(`| Testes e validação | ${Math.ceil(totalDays * 0.25)} dia(s) |`);
      lines.push(`| Deploy e acompanhamento | ${Math.ceil(totalDays * 0.10)} dia(s) |`);
      lines.push('');
    }

    // 5. Risks
    lines.push('## Riscos e Mitigações', '');
    if (fc.impactAnalysis) {
      lines.push(`- **Nível de risco geral**: ${fc.impactAnalysis.riskLevel}`);
      if (fc.impactAnalysis.breakingChanges.length > 0) {
        lines.push(`- **${fc.impactAnalysis.breakingChanges.length}** mudança(s) que pode(m) afetar funcionalidades existentes`);
        lines.push('  - Mitigação: testes automatizados e validação em ambiente de homologação antes de produção');
      }
      lines.push('');
    }

    // 6. Next Steps
    lines.push('## Próximos Passos', '');
    lines.push('1. Validação do escopo com stakeholders');
    lines.push('2. Aprovação do cronograma e alocação de recursos');
    lines.push('3. Início do desenvolvimento');
    lines.push('4. Revisão e testes de aceitação');
    lines.push('5. Deploy em homologação e validação');
    lines.push('6. Deploy em produção');
    lines.push('');

    // Simplified journey diagram
    lines.push('## Jornada do Usuário', '');
    lines.push('```mermaid');
    lines.push('graph LR');
    lines.push(`  A["Usuário"] --> B["Acessa ${feature}"]`);
    lines.push('  B --> C["Preenche dados"]');
    lines.push('  C --> D["Sistema valida"]');
    lines.push('  D --> E["Dados salvos"]');
    lines.push('  E --> F["Confirmação"]');
    lines.push('```');
    lines.push('');

    return lines.join('\n');
  }
}
