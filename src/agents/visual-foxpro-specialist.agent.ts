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
      const vfpServiceFiles = repo.services.filter((s) => /\.(prg|vcx|vct)$/i.test(s.filePath));
      const vfpFormFiles = repo.components?.filter((c) => /\.xml$/i.test(c.filePath)) ?? [];
      const reusableLibraries = repo.reusableComponents?.filter((rc) => /\.(vcx|vct|prg)$/i.test(rc.filePath) || rc.category === 'shared' || rc.category === 'lib') ?? [];

      const hasPrg = vfpServiceFiles.length > 0 || repo.languages.some((l) => l.language === 'Visual FoxPro');
      const hasXmlForms = vfpFormFiles.length > 0 || repo.services.some((s) => /\.xml$/i.test(s.filePath));
      const hasReusableLibraries = reusableLibraries.length > 0;

      patterns.push('Visual FoxPro 9.0 como base de um sistema legado robusto');

      if (hasPrg) {
        patterns.push('Implementação em .prg com DEFINE CLASS, PROCEDURE e FUNCTION');
        patterns.push('Lógica de negócio encapsulada em módulos VFP e classes definidas no runtime');
      }

      if (hasXmlForms) {
        patterns.push('Formulários/telas convertidos de .scx/.sct para .xml');
        patterns.push('UI VFP tratada como XML convertido, com code-behind em .prg');
      }

      if (hasReusableLibraries) {
        patterns.push('Bibliotecas reutilizáveis detectadas em .vcx/.vct e componentes compartilhados');
      }

      if (repo.reusableComponents?.length) {
        patterns.push('Estruturas reutilizáveis analisáveis: helpers, componentes comuns e módulos de domínio');
      }

      conventions.push(
        'Arquivos .prg para regras de negócio, serviços e data access em VFP',
        'Arquivos .xml para formulários convertidos de .scx/.sct; alterações de UI devem ser feitas no XML e no code-behind .prg',
        'Arquivos .vcx/.vct como bibliotecas de classes e componentes visuais reutilizados',
        'Prefixos e convenções de VFP: naming de controles e variáveis, uso explícito de LOCAL/ LPARAMETERS',
        'Preservar o modelo de dados existente e evitar reescrever camadas críticas sem necessidade',
      );

      recommendations.push(
        'Reconhecer o sistema como legado robusto e priorizar estabilidade antes de migração',
        'Identificar classes e bibliotecas reutilizáveis (.vcx, .vct, .prg) para reaproveitamento imediato',
        'Preservar formulários convertidos (.xml) como fonte de verdade das telas',
        'Criar uma camada de abstração de dados para separar DBF/SQL de regras de negócio',
        'Usar SQL pass-through (SQLEXEC) e CursorAdapter para novos acessos a dados',
        'Atualizar incrementalmente em módulos críticos, mantendo comportamentos existentes',
        'Documentar dependências do runtime VFP e pontos de integração COM/SQL Server',
      );

      codeSmells.push(
        'Formulários monolíticos e monolitos de UI sem modularização',
        'Duplicação de lógica entre formulários e procedimentos',
        'Uso excessivo de macros (&) e SCATTER/GATHER que dificultam leitura',
        'Dependência direta de tabelas DBF sem camada de abstração de dados',
        'Variáveis PUBLIC e global state que tornam o legado frágil',
      );

      bestPractices.push(
        'Reutilizar bibliotecas de classes existentes e componentes comuns antes de refatorar',
        'Manter separação de BLL/DAL em .prg quando possível',
        'Usar TRY/CATCH/FINALLY para proteger operações críticas de banco e arquivos',
        'Preservar e documentar fluxos de dados do sistema legado ao introduzir mudanças',
        'Criar wrappers para acesso a DBF/SQL para proteger código legado durante evolução',
        'Estruturar formulários convertidos .xml como peças reutilizáveis e manter naming consistente',
        'Identificar componentes de domínio estabilizados que podem ser reaproveitados em novos módulos',
      );
    }

    return { language: 'Visual FoxPro', patterns, conventions, recommendations, codeSmells, bestPractices };
  }
}
