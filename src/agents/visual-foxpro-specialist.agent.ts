import { AgentRole, FeatureContext, LanguageSpecificAnalysis } from '../types';
import { LanguageSpecialistAgent } from './base-language-specialist';

export class VisualFoxProSpecialistAgent extends LanguageSpecialistAgent {
  readonly role = AgentRole.VisualFoxProSpecialist;
  readonly name = 'Visual FoxPro Specialist';
  readonly targetLanguage = 'Visual FoxPro';

  public isRelevant(fc: FeatureContext): boolean {
    if (!fc.repositoryContext) return false;
    // VFP files detected by file-scanner as Visual FoxPro, or .prg extension
    return fc.repositoryContext.languages.some(
      (l) => l.language.toLowerCase().includes('foxpro') || l.language.toLowerCase().includes('prg'),
    );
  }

  protected async offlineAnalyze(fc: FeatureContext): Promise<LanguageSpecificAnalysis> {
    const repo = fc.repositoryContext;
    const patterns: string[] = [];
    const conventions: string[] = [];
    const recommendations: string[] = [];
    const codeSmells: string[] = [];
    const bestPractices: string[] = [];

    if (repo) {
      patterns.push('Visual FoxPro 9.0 (sistema legado)');

      recommendations.push(
        'Avaliar migração para .NET/C# com estratégia incremental',
        'Substituir tabelas DBF por SQL Server para concorrência',
        'Implementar COM Interop para integração com .NET durante migração',
        'Criar camada de abstração para dados antes de migrar',
      );

      codeSmells.push(
        'Código procedural sem separação de responsabilidades',
        'Uso excessivo de macros (&) que dificulta manutenção',
        'SCATTER/GATHER sem estrutura tipada',
      );

      bestPractices.push(
        'SQLEXEC para acesso client-server',
        'CursorAdapter para abstração de dados',
        'TRY/CATCH para tratamento de erros',
        'Migração incremental módulo por módulo',
      );
    }

    return { language: 'Visual FoxPro', patterns, conventions, recommendations, codeSmells, bestPractices };
  }
}
