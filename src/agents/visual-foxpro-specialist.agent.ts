import { AgentRole, FeatureContext, LanguageSpecificAnalysis } from '../types';
import { LanguageSpecialistAgent } from './base-language-specialist';

export class VisualFoxProSpecialistAgent extends LanguageSpecialistAgent {
  readonly role = AgentRole.VisualFoxProSpecialist;
  readonly name = 'Visual FoxPro Specialist';
  readonly targetLanguage = 'Visual FoxPro';

  public isRelevant(fc: FeatureContext): boolean {
    if (!fc.repositoryContext) return false;
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
      // ── Detect VFP file types and patterns ───────────────
      const vfpFiles = repo.services
        .filter((s) => /\.prg$/i.test(s.filePath))
        .map((s) => s.filePath);
      const xmlFormFiles = repo.languages
        .filter((l) => l.language === 'Visual FoxPro')
        ? repo.services.filter((s) => /\.xml$/i.test(s.filePath))
        : [];

      const hasPrg = vfpFiles.length > 0 || repo.languages.some((l) => l.language === 'Visual FoxPro');
      const hasXmlForms = xmlFormFiles.length > 0 ||
        repo.components?.some((c) => /\.xml$/i.test(c.filePath)) || false;

      patterns.push('Visual FoxPro 9.0 (sistema legado)');

      if (hasPrg) {
        patterns.push('Código-fonte em arquivos .prg (classes, procedures, funções)');
      }

      if (hasXmlForms) {
        patterns.push('Formulários/telas convertidos de .scx/.sct para .xml');
        patterns.push('Análises e alterações de UI devem ser feitas nos arquivos .xml convertidos');
      }

      // ── Conventions for VFP projects ───────────────────
      conventions.push(
        'Arquivos .prg: lógica de negócio, classes (DEFINE CLASS), procedures e funções',
        'Arquivos .xml: formulários/telas convertidos de .scx/.sct — toda análise de UI nestes arquivos',
        'Arquivos .vcx/.vct: bibliotecas de classes visuais (podem também estar convertidos para .xml)',
        'Naming: prefixos húngaros (tc=char, tn=numeric, tl=logical, to=object, lo=local object)',
        'LOCAL para todas as variáveis — evitar PUBLIC e PRIVATE',
      );

      // ── Recommendations ────────────────────────────────
      recommendations.push(
        'Avaliar migração para .NET/C# com estratégia incremental',
        'Substituir tabelas DBF por SQL Server para concorrência',
        'Implementar COM Interop para integração com .NET durante migração',
        'Criar camada de abstração para dados antes de migrar',
        'Manter formulários convertidos (.xml) como fonte de verdade para alterações de UI',
        'Usar SQL pass-through (SQLEXEC) em vez de acesso direto a DBF para novos módulos',
        'Implementar TRY/CATCH em todas as operações críticas',
      );

      // ── Code smells ────────────────────────────────────
      codeSmells.push(
        'Código procedural sem separação de responsabilidades',
        'Uso excessivo de macros (&) que dificulta manutenção',
        'SCATTER/GATHER sem estrutura tipada',
        'Variáveis PUBLIC que poluem o namespace global',
        'Acesso direto a tabelas DBF sem camada de abstração',
        'Formulários monolíticos sem componentização',
      );

      // ── Best practices ─────────────────────────────────
      bestPractices.push(
        'SQLEXEC para acesso client-server (SQL pass-through)',
        'CursorAdapter para abstração de dados',
        'TRY/CATCH/FINALLY para tratamento de erros',
        'DEFINE CLASS com herança para componentização',
        'Formulários em .xml (convertidos de .scx/.sct) — editar XML para alterações de tela',
        'Arquivos .prg para lógica de negócio e data access',
        'Separação BLL (Business Logic Layer) / DAL (Data Access Layer) em .prg',
        'Migração incremental módulo por módulo',
        'FoxUnit para testes unitários',
      );
    }

    return { language: 'Visual FoxPro', patterns, conventions, recommendations, codeSmells, bestPractices };
  }
}
