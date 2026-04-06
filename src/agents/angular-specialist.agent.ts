import { AgentRole, FeatureContext, LanguageSpecificAnalysis } from '../types';
import { LanguageSpecialistAgent } from './base-language-specialist';

export class AngularSpecialistAgent extends LanguageSpecialistAgent {
  readonly role = AgentRole.AngularSpecialist;
  readonly name = 'Angular Specialist';
  readonly targetLanguage = 'Angular';

  public isRelevant(fc: FeatureContext): boolean {
    if (!fc.repositoryContext) return false;
    return fc.repositoryContext.frameworks.some(
      (f) => f.name.toLowerCase().includes('angular'),
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
      const fwNames = repo.frameworks.map((f) => f.name.toLowerCase());
      patterns.push('Angular Framework');
      if (fwNames.some((f) => f.includes('ngrx'))) patterns.push('NgRx State Management');
      if (fwNames.some((f) => f.includes('rxjs'))) patterns.push('RxJS Reactive Programming');
      if (fwNames.some((f) => f.includes('angular material'))) patterns.push('Angular Material UI');
      if (fwNames.some((f) => f.includes('primeng'))) patterns.push('PrimeNG UI');

      const components = repo.components;
      if (components.length > 0) conventions.push(`${components.length} componente(s) Angular detectado(s)`);

      const services = repo.services;
      if (services.length > 0) conventions.push(`${services.length} serviço(s) Angular detectado(s)`);

      bestPractices.push(
        'OnPush change detection para performance',
        'Reactive Forms com tipagem (Typed Forms)',
        'Lazy loading de feature modules',
        'Standalone components (Angular 14+)',
        'trackBy em *ngFor para performance',
      );
      recommendations.push(
        'Migrar para standalone components e signals',
        'Usar @defer para carregamento sob demanda',
        'Implementar interceptors para autenticação',
      );
    }

    return { language: 'Angular', patterns, conventions, recommendations, codeSmells, bestPractices };
  }
}
