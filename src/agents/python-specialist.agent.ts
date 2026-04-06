import { AgentRole, FeatureContext, LanguageSpecificAnalysis } from '../types';
import { LanguageSpecialistAgent } from './base-language-specialist';

export class PythonSpecialistAgent extends LanguageSpecialistAgent {
  readonly role = AgentRole.PythonSpecialist;
  readonly name = 'Python Specialist';
  readonly targetLanguage = 'Python';

  protected async offlineAnalyze(fc: FeatureContext): Promise<LanguageSpecificAnalysis> {
    const repo = fc.repositoryContext;
    const patterns: string[] = [];
    const conventions: string[] = [];
    const recommendations: string[] = [];
    const codeSmells: string[] = [];
    const bestPractices: string[] = [];

    if (repo) {
      const fwNames = repo.frameworks.map((f) => f.name.toLowerCase());
      if (fwNames.some((f) => f.includes('django'))) patterns.push('Django Framework');
      if (fwNames.some((f) => f.includes('fastapi'))) patterns.push('FastAPI Framework');
      if (fwNames.some((f) => f.includes('flask'))) patterns.push('Flask Framework');
      if (fwNames.some((f) => f.includes('sqlalchemy'))) patterns.push('SQLAlchemy ORM');
      if (fwNames.some((f) => f.includes('pydantic'))) patterns.push('Pydantic Models');
      if (fwNames.some((f) => f.includes('pytest'))) patterns.push('Pytest Testing');
      if (fwNames.some((f) => f.includes('celery'))) patterns.push('Celery Task Queue');

      conventions.push('PEP 8 — snake_case para funções e variáveis');

      bestPractices.push(
        'Type hints completos (mypy strict)',
        'Pydantic para validação e serialização',
        'Async/await para I/O bound operations',
        'Poetry ou pip-tools para gerenciamento de dependências',
        'Logging estruturado com structlog',
      );
      recommendations.push(
        'Testes com pytest e coverage mínimo 80%',
        'Linting com ruff (substitui flake8+isort+black)',
      );
    }

    return { language: 'Python', patterns, conventions, recommendations, codeSmells, bestPractices };
  }
}
