import { AgentRole, FeatureContext, LanguageSpecificAnalysis } from '../types';
import { LanguageSpecialistAgent } from './base-language-specialist';

export class WebSpecialistAgent extends LanguageSpecialistAgent {
  readonly role = AgentRole.WebSpecialist;
  readonly name = 'Web Specialist';
  readonly targetLanguage = 'HTML';

  public isRelevant(fc: FeatureContext): boolean {
    if (!fc.repositoryContext) return false;
    const langs = fc.repositoryContext.languages.map((l) => l.language.toLowerCase());
    return langs.some((l) => ['html', 'css', 'scss', 'javascript'].includes(l));
  }

  protected async offlineAnalyze(fc: FeatureContext): Promise<LanguageSpecificAnalysis> {
    const repo = fc.repositoryContext;
    const patterns: string[] = [];
    const conventions: string[] = [];
    const recommendations: string[] = [];
    const codeSmells: string[] = [];
    const bestPractices: string[] = [];

    if (repo) {
      const langs = repo.languages.map((l) => l.language.toLowerCase());
      if (langs.includes('html')) patterns.push('HTML5');
      if (langs.includes('css') || langs.includes('scss') || langs.includes('sass')) patterns.push('CSS3');
      if (langs.includes('javascript')) patterns.push('JavaScript ES2022+');
      if (langs.includes('scss')) patterns.push('SCSS Preprocessor');

      const fwNames = repo.frameworks.map((f) => f.name.toLowerCase());
      if (fwNames.some((f) => f.includes('tailwind'))) patterns.push('Tailwind CSS');
      if (fwNames.some((f) => f.includes('bootstrap'))) patterns.push('Bootstrap');
      if (fwNames.some((f) => f.includes('vite'))) patterns.push('Vite Bundler');
      if (fwNames.some((f) => f.includes('webpack'))) patterns.push('Webpack Bundler');

      bestPractices.push(
        'HTML semântico para acessibilidade',
        'CSS custom properties para temas',
        'Responsive design com media queries',
        'Lazy loading de imagens e recursos',
        'CSP headers para segurança',
      );
      recommendations.push(
        'Acessibilidade WCAG 2.1 AA',
        'Performance Core Web Vitals',
        'Progressive Enhancement',
      );
    }

    return { language: 'HTML/CSS/JavaScript', patterns, conventions, recommendations, codeSmells, bestPractices };
  }
}
