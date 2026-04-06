import { AgentRole, FeatureContext, LanguageSpecificAnalysis } from '../types';
import { LanguageSpecialistAgent } from './base-language-specialist';

export class SqlSpecialistAgent extends LanguageSpecialistAgent {
  readonly role = AgentRole.SqlSpecialist;
  readonly name = 'SQL Specialist';
  readonly targetLanguage = 'SQL';

  protected async offlineAnalyze(fc: FeatureContext): Promise<LanguageSpecificAnalysis> {
    const repo = fc.repositoryContext;
    const patterns: string[] = [];
    const conventions: string[] = [];
    const recommendations: string[] = [];
    const codeSmells: string[] = [];
    const bestPractices: string[] = [];

    if (repo) {
      const dbScripts = repo.databaseScripts;
      if (dbScripts.length > 0) {
        patterns.push(`${dbScripts.length} script(s) SQL detectado(s)`);

        const types = new Set(dbScripts.map((s) => s.type));
        if (types.has('migration')) patterns.push('Migrações versionadas');
        if (types.has('procedure')) patterns.push('Stored Procedures');
        if (types.has('query')) patterns.push('Queries');

        for (const script of dbScripts) {
          if (script.tables.length > 0) {
            conventions.push(`Script ${script.filePath}: tabelas ${script.tables.join(', ')}`);
          }
        }
      }

      const db = fc.databaseSummary;
      if (db) {
        recommendations.push('Verificar índices para queries frequentes');
        recommendations.push('Revisar constraints de integridade referencial');
      }

      bestPractices.push(
        'Parameterized queries (nunca concatenar valores)',
        'Transaction isolation levels adequados',
        'Versionamento de migrações',
        'Scripts de rollback para cada migração',
      );
    }

    return { language: 'SQL', patterns, conventions, recommendations, codeSmells, bestPractices };
  }
}
