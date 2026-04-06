import { AgentRole, FeatureContext, LanguageSpecificAnalysis } from '../types';
import { LanguageSpecialistAgent } from './base-language-specialist';

export class CSharpDotNetSpecialistAgent extends LanguageSpecialistAgent {
  readonly role = AgentRole.CSharpDotNetSpecialist;
  readonly name = 'C#/.NET Specialist';
  readonly targetLanguage = 'C#';

  protected async offlineAnalyze(fc: FeatureContext): Promise<LanguageSpecificAnalysis> {
    const repo = fc.repositoryContext;
    const patterns: string[] = [];
    const conventions: string[] = [];
    const recommendations: string[] = [];
    const codeSmells: string[] = [];
    const bestPractices: string[] = [];

    if (repo) {
      const fwNames = repo.frameworks.map((f) => f.name.toLowerCase());
      if (fwNames.some((f) => f.includes('asp.net') || f.includes('aspnet'))) patterns.push('ASP.NET Core');
      if (fwNames.some((f) => f.includes('entity framework') || f.includes('efcore'))) patterns.push('Entity Framework Core');
      if (fwNames.some((f) => f.includes('mediatr'))) patterns.push('CQRS + MediatR');
      if (fwNames.some((f) => f.includes('blazor'))) patterns.push('Blazor');

      const arch = repo.architecturePattern;
      if (arch.primary) patterns.push(arch.primary);
      if (arch.patterns.length > 0) patterns.push(...arch.patterns);

      const services = repo.services;
      if (services.length > 0) conventions.push(`${services.length} serviço(s) detectado(s)`);

      const repos = repo.repositories;
      if (repos.length > 0) patterns.push('Repository Pattern');

      bestPractices.push(
        'Async/await com CancellationToken',
        'Nullable reference types habilitado',
        'IOptions<T> para configurações tipadas',
        'FluentValidation para validação de entrada',
      );
      recommendations.push(
        'Health checks para monitoramento',
        'Structured logging com Serilog',
      );
    }

    return { language: 'C#/.NET', patterns, conventions, recommendations, codeSmells, bestPractices };
  }
}
