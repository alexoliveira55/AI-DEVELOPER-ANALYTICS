import { AgentRole, FeatureContext, LanguageSpecificAnalysis } from '../types';
import { LanguageSpecialistAgent } from './base-language-specialist';

export class FlutterDartSpecialistAgent extends LanguageSpecialistAgent {
  readonly role = AgentRole.FlutterDartSpecialist;
  readonly name = 'Flutter/Dart Specialist';
  readonly targetLanguage = 'Dart';

  protected async offlineAnalyze(fc: FeatureContext): Promise<LanguageSpecificAnalysis> {
    const repo = fc.repositoryContext;
    const patterns: string[] = [];
    const conventions: string[] = [];
    const recommendations: string[] = [];
    const codeSmells: string[] = [];
    const bestPractices: string[] = [];

    if (repo) {
      const fwNames = repo.frameworks.map((f) => f.name.toLowerCase());
      if (fwNames.some((f) => f.includes('flutter'))) patterns.push('Flutter Framework');
      if (fwNames.some((f) => f.includes('bloc'))) patterns.push('BLoC Pattern');
      if (fwNames.some((f) => f.includes('riverpod'))) patterns.push('Riverpod');
      if (fwNames.some((f) => f.includes('provider'))) patterns.push('Provider');
      if (fwNames.some((f) => f.includes('getx') || f.includes('get_it'))) patterns.push('GetX / get_it');

      const files = [...repo.services.map((s) => s.filePath), ...repo.components.map((c) => c.filePath)];
      if (files.some((f) => f.includes('/bloc/'))) patterns.push('BLoC Architecture');
      if (files.some((f) => f.includes('/domain/'))) patterns.push('Clean Architecture');
      if (files.some((f) => f.includes('/cubit/'))) patterns.push('Cubit Pattern');

      bestPractices.push('Null Safety', 'Immutability com freezed/json_serializable');
      recommendations.push('Widget tests para componentes críticos', 'Integration tests para fluxos principais');
    }

    return { language: 'Dart/Flutter', patterns, conventions, recommendations, codeSmells, bestPractices };
  }
}
