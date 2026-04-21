import { BaseAgent } from '../core';
import { Labels } from '../config';
import {
  AgentRole,
  FeatureContext,
  ImplementationPlan,
  SessionContext,
  SolutionArchitecture,
} from '../types';

/**
 * Creates a detailed implementation plan as a software architect specialist.
 * Proposes assertive solutions based on existing product structure, avoids
 * high-risk refactorings that increase testing scenarios, and applies clean
 * code best practices.
 */
export class ImplementationPlanAgent extends BaseAgent<FeatureContext, ImplementationPlan> {
  readonly role = AgentRole.ImplementationPlan;
  readonly name = 'Implementation Plan Architect';

  protected async run(
    fc: FeatureContext,
    _context: SessionContext,
  ): Promise<ImplementationPlan> {
    const solution = fc.solutionArchitecture!;
    const repo = fc.repositoryContext;
    const requirements = fc.requirementsAnalysis!;
    const scope = fc.scopeDefinition!;

    const currentArchitecture = repo?.architecturePattern.primary ?? 'Unknown';
    const frameworks = repo?.frameworks ?? [];
    const existingPatterns = repo?.architecturePattern.patterns ?? [];

    // Analyze existing codebase for patterns and conventions
    const codePatterns = this.analyzeExistingPatterns(repo);
    const riskAssessment = this.assessImplementationRisks(solution, repo, requirements);

    // Generate implementation phases
    const phases = this.createImplementationPhases(solution, scope, codePatterns, riskAssessment);

    // Identify clean code practices to apply
    const cleanCodePractices = this.defineCleanCodePractices(solution, frameworks.map(f => f.name));

    // Create testing strategy
    const testingStrategy = this.createTestingStrategy(phases, riskAssessment);

    // Define deployment approach
    const deploymentApproach = this.defineDeploymentApproach(solution, existingPatterns);

    return {
      overview: Labels.implementationPlan.overview,
      currentArchitecture,
      implementationPhases: phases,
      cleanCodePractices,
      testingStrategy,
      deploymentApproach,
      riskAssessment,
      estimatedTimeline: this.estimateTimeline(phases, riskAssessment),
      successCriteria: this.defineSuccessCriteria(requirements, solution),
    };
  }

  private analyzeExistingPatterns(repo: FeatureContext['repositoryContext']): string[] {
    const patterns: string[] = [];

    if (repo?.services) {
      const servicePatterns = repo.services
        .map(s => s.methods.join(', '))
        .filter((p, i, arr) => arr.indexOf(p) === i);
      patterns.push(...servicePatterns);
    }

    if (repo?.controllers) {
      const controllerPatterns = repo.controllers
        .map(c => c.actions.map(a => a.httpMethod).join(', '))
        .filter((p, i, arr) => arr.indexOf(p) === i);
      patterns.push(...controllerPatterns);
    }

    return patterns;
  }

  private assessImplementationRisks(
    solution: SolutionArchitecture,
    repo: FeatureContext['repositoryContext'],
    requirements: FeatureContext['requirementsAnalysis']
  ): { level: 'low' | 'medium' | 'high'; factors: string[]; mitigations: string[] } {
    const factors: string[] = [];
    const mitigations: string[] = [];

    // Assess new components risk
    const newComponents = solution.proposedComponents.filter(c => c.isNew);
    if (newComponents.length > 5) {
      factors.push('High number of new components increases integration complexity');
      mitigations.push('Implement components incrementally with thorough testing');
    }

    // Assess framework changes
    const newFrameworks = solution.proposedComponents
      .filter(c => c.isNew && c.dependencies.some(d => !repo?.frameworks?.some((f: any) => f.name === d)))
      .length;
    if (newFrameworks > 0) {
      factors.push('Introduction of new frameworks increases learning curve');
      mitigations.push('Ensure team training and gradual adoption');
    }

    // Assess data layer changes
    const dataComponents = newComponents.filter(c => c.type === 'repository' || c.type === 'migration');
    if (dataComponents.length > 0) {
      factors.push('Data layer changes require careful migration planning');
      mitigations.push('Create rollback scripts and test data integrity');
    }

    const riskLevel = factors.length > 2 ? 'high' : factors.length > 0 ? 'medium' : 'low';

    return { level: riskLevel, factors, mitigations };
  }

  private createImplementationPhases(
    solution: SolutionArchitecture,
    scope: FeatureContext['scopeDefinition'],
    codePatterns: string[],
    riskAssessment: any
  ): Array<{ phase: string; components: string[]; tasks: string[]; duration: string; dependencies: string[] }> {
    const phases: Array<{ phase: string; components: string[]; tasks: string[]; duration: string; dependencies: string[] }> = [];

    // Phase 1: Foundation
    const foundationComponents = solution.proposedComponents
      .filter(c => c.type === 'repository' || c.type === 'migration')
      .map(c => c.name);

    phases.push({
      phase: 'Foundation',
      components: foundationComponents,
      tasks: [
        'Set up data layer and migrations',
        'Implement core data access patterns',
        'Create database schemas if needed',
        'Establish connection configurations'
      ],
      duration: '1-2 weeks',
      dependencies: []
    });

    // Phase 2: Core Services
    const serviceComponents = solution.proposedComponents
      .filter(c => c.type === 'service')
      .map(c => c.name);

    phases.push({
      phase: 'Core Services',
      components: serviceComponents,
      tasks: [
        'Implement business logic following existing patterns',
        'Apply clean code principles (SOLID, DRY)',
        'Add comprehensive error handling',
        'Create unit tests for business rules'
      ],
      duration: '2-3 weeks',
      dependencies: ['Foundation']
    });

    // Phase 3: API/Controllers
    const controllerComponents = solution.proposedComponents
      .filter(c => c.type === 'controller')
      .map(c => c.name);

    phases.push({
      phase: 'API Layer',
      components: controllerComponents,
      tasks: [
        'Implement REST endpoints following existing conventions',
        'Add input validation and sanitization',
        'Implement proper HTTP status codes',
        'Create API documentation'
      ],
      duration: '1-2 weeks',
      dependencies: ['Core Services']
    });

    // Phase 4: UI/Integration
    const uiComponents = solution.proposedComponents
      .filter(c => c.type === 'form')
      .map(c => c.name);

    phases.push({
      phase: 'User Interface & Integration',
      components: uiComponents,
      tasks: [
        'Implement UI components following design patterns',
        'Integrate with existing UI framework',
        'Add client-side validation',
        'Implement user interaction flows'
      ],
      duration: '2-3 weeks',
      dependencies: ['API Layer']
    });

    // Phase 5: Testing & Refinement
    phases.push({
      phase: 'Testing & Refinement',
      components: [],
      tasks: [
        'Implement integration tests',
        'Perform end-to-end testing',
        'Code review and refactoring',
        'Performance optimization'
      ],
      duration: '1-2 weeks',
      dependencies: ['User Interface & Integration']
    });

    return phases;
  }

  private defineCleanCodePractices(
    solution: SolutionArchitecture,
    frameworks: string[]
  ): Array<{ practice: string; description: string; components: string[] }> {
    const practices: Array<{ practice: string; description: string; components: string[] }> = [];

    practices.push({
      practice: 'SOLID Principles',
      description: 'Apply Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion principles',
      components: solution.proposedComponents.map(c => c.name)
    });

    practices.push({
      practice: 'DRY (Don\'t Repeat Yourself)',
      description: 'Extract common functionality into reusable methods and classes',
      components: solution.proposedComponents.filter(c => c.isNew).map(c => c.name)
    });

    practices.push({
      practice: 'Meaningful Naming',
      description: 'Use descriptive names for variables, methods, and classes that clearly express intent',
      components: solution.proposedComponents.map(c => c.name)
    });

    practices.push({
      practice: 'Error Handling',
      description: 'Implement proper exception handling with meaningful error messages',
      components: solution.proposedComponents.filter(c => c.type === 'service' || c.type === 'controller').map(c => c.name)
    });

    if (frameworks.some(f => f.includes('typescript') || f.includes('javascript'))) {
      practices.push({
        practice: 'TypeScript Best Practices',
        description: 'Use strong typing, avoid any types, and leverage TypeScript features for better code quality',
        components: solution.proposedComponents.map(c => c.name)
      });
    }

    return practices;
  }

  private createTestingStrategy(
    phases: any[],
    riskAssessment: any
  ): { approach: string; types: string[]; tools: string[]; coverage: string } {
    const types = ['Unit Tests', 'Integration Tests', 'End-to-End Tests'];
    const tools = ['Jest', 'Mocha', 'Selenium']; // Generic, can be adjusted based on frameworks

    let coverage = '80%';
    if (riskAssessment.level === 'high') {
      coverage = '90%';
      types.push('Performance Tests');
    }

    return {
      approach: 'Test-Driven Development with comprehensive coverage',
      types,
      tools,
      coverage
    };
  }

  private defineDeploymentApproach(
    solution: SolutionArchitecture,
    existingPatterns: string[]
  ): { strategy: string; steps: string[]; rollback: string[] } {
    const hasDatabaseChanges = solution.proposedComponents.some(c => c.type === 'migration');
    const hasNewServices = solution.proposedComponents.some(c => c.type === 'service' && c.isNew);

    let strategy = 'Incremental deployment with feature flags';
    if (hasDatabaseChanges) {
      strategy = 'Blue-green deployment with database migration scripts';
    }

    const steps = [
      'Create deployment scripts',
      'Set up staging environment',
      'Run automated tests in staging',
      'Gradual rollout with monitoring',
      'Full production deployment'
    ];

    const rollback = [
      'Maintain previous version for quick rollback',
      'Prepare database rollback scripts',
      'Monitor key metrics post-deployment',
      'Have rollback plan documented and tested'
    ];

    return { strategy, steps, rollback };
  }

  private estimateTimeline(phases: any[], riskAssessment: any): string {
    const baseWeeks = phases.reduce((total, phase) => {
      const match = phase.duration.match(/(\d+)-(\d+)/);
      if (match) {
        return total + (parseInt(match[1]) + parseInt(match[2])) / 2;
      }
      return total + 2; // Default 2 weeks
    }, 0);

    const riskMultiplier = riskAssessment.level === 'high' ? 1.5 : riskAssessment.level === 'medium' ? 1.2 : 1.0;

    return `${Math.ceil(baseWeeks * riskMultiplier)} weeks`;
  }

  private defineSuccessCriteria(
    requirements: FeatureContext['requirementsAnalysis'],
    solution: SolutionArchitecture
  ): string[] {
    const criteria: string[] = [];

    criteria.push('All functional requirements implemented and tested');
    criteria.push('Non-functional requirements met (performance, security, etc.)');
    criteria.push('Code follows established patterns and clean code principles');
    criteria.push('All automated tests pass with required coverage');
    criteria.push('Successful deployment to production environment');
    criteria.push('No critical bugs reported in first 30 days post-deployment');

    return criteria;
  }
}