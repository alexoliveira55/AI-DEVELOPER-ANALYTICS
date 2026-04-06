import { BaseAgent } from '../core';
import { AgentRole, FeatureContext, SessionContext } from '../types';

/**
 * Generates three summary variants: one-liner, elevator pitch, and sprint planning summary.
 */
export class SummaryGeneratorAgent extends BaseAgent<FeatureContext, string> {
  readonly role = AgentRole.SummaryGenerator;
  readonly name = 'Summary Generator';

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

    const totalHours = fc.estimation?.totalHours ?? 0;
    const confidence = fc.estimation?.confidence ?? 'N/A';
    const riskLevel = fc.impactAnalysis?.riskLevel ?? 'N/A';
    const newModules = fc.scopeDefinition?.newModules.length ?? 0;
    const affectedModules = fc.scopeDefinition?.affectedModules.length ?? 0;
    const complexity = fc.scopeDefinition?.estimatedComplexity ?? 'N/A';
    const reuseScore = fc.reuseAnalysis?.reuseScore ?? 0;

    // One-liner
    lines.push('## Resumo Rápido', '');
    lines.push('### Em uma frase');
    lines.push(`Implementação de "${feature}" — ${totalHours}h estimadas, complexidade ${complexity}, risco ${riskLevel}.`, '');

    // Elevator pitch
    lines.push('### Elevator Pitch');
    lines.push(`A funcionalidade **${feature}** envolve a criação de ${newModules} novo(s) módulo(s) `);
    lines.push(`e a modificação de ${affectedModules} módulo(s) existente(s). `);
    lines.push(`A estimativa total é de **${totalHours} horas** (confiança: ${confidence}), `);
    lines.push(`com nível de risco **${riskLevel}**. `);
    if (reuseScore > 0) {
      lines.push(`O score de reuso é de ${reuseScore}%, reduzindo o esforço de implementação. `);
    }
    lines.push(`A complexidade geral é **${complexity}**.`, '');

    // Sprint planning
    lines.push('### Para Daily/Sprint', '');
    lines.push(`**Funcionalidade**: ${feature}`, '');
    lines.push(`**Escopo**: ${newModules} novo(s) módulo(s), ${affectedModules} módulo(s) afetado(s)`);
    lines.push(`**Complexidade**: ${complexity}`);
    lines.push(`**Estimativa**: ${totalHours}h (${Math.ceil(totalHours / 8)} dia(s) útil(eis))`);
    lines.push(`**Risco**: ${riskLevel}`);
    lines.push(`**Reuso**: ${reuseScore}%`);
    lines.push(`**Confiança**: ${confidence}`, '');

    if (fc.impactAnalysis?.breakingChanges && fc.impactAnalysis.breakingChanges.length > 0) {
      lines.push('**Riscos principais**:');
      for (const bc of fc.impactAnalysis.breakingChanges.slice(0, 3)) {
        lines.push(`- ${bc}`);
      }
      lines.push('');
    }

    if (fc.scopeDefinition?.affectedModules && fc.scopeDefinition.affectedModules.length > 0) {
      lines.push('**Módulos impactados**:');
      for (const m of fc.scopeDefinition.affectedModules.slice(0, 5)) {
        lines.push(`- ${m}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
