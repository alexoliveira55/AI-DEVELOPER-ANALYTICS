import { BaseAgent } from '../core';
import {
  AgentRole, FeatureContext, FlowchartOutput, SessionContext,
  SolutionArchitecture,
} from '../types';

/** Generates Mermaid.js flowcharts, sequence diagrams, class diagrams from the solution. */
export class FlowchartGeneratorAgent extends BaseAgent<FeatureContext, FlowchartOutput[]> {
  readonly role = AgentRole.FlowchartGenerator;
  readonly name = 'Flowchart Generator';

  protected async run(fc: FeatureContext, ctx: SessionContext): Promise<FlowchartOutput[]> {
    return this.withLlmFallback(
      () => this.llmGenerate(fc, ctx),
      () => this.offlineGenerate(fc),
    );
  }

  private async llmGenerate(_fc: FeatureContext, _ctx: SessionContext): Promise<FlowchartOutput[]> {
    // LLM call with prompts/flowchart-generator-agent.txt — placeholder
    return this.offlineGenerate(_fc);
  }

  private async offlineGenerate(fc: FeatureContext): Promise<FlowchartOutput[]> {
    const charts: FlowchartOutput[] = [];
    const sol = fc.solutionArchitecture;
    if (!sol) return charts;

    charts.push(this.buildMainFlowchart(sol, fc.rawRequirements ?? 'funcionalidade'));
    charts.push(this.buildSequenceDiagram(sol));

    if (sol.proposedComponents.length > 0) {
      charts.push(this.buildClassDiagram(sol));
    }

    this.logger.info(`Generated ${charts.length} flowchart(s)`);
    return charts;
  }

  private buildMainFlowchart(sol: SolutionArchitecture, feature: string): FlowchartOutput {
    const lines: string[] = ['graph TD'];
    lines.push('  A["Requisição do Usuário"] --> B["Validação de Entrada"]');

    const controllers = sol.proposedComponents.filter((c) => c.type === 'controller');
    const services = sol.proposedComponents.filter((c) => c.type === 'service');
    const repos = sol.proposedComponents.filter((c) => c.type === 'repository');

    if (controllers.length > 0) {
      lines.push(`  B --> C["${controllers[0].name}"]`);
      if (services.length > 0) {
        lines.push(`  C --> D["${services[0].name}"]`);
        if (repos.length > 0) {
          lines.push(`  D --> E["${repos[0].name}"]`);
          lines.push('  E --> F[("Banco de Dados")]');
          lines.push('  F --> E');
          lines.push('  E --> D');
        }
        lines.push('  D --> C');
      }
      lines.push('  C --> G["Resposta ao Usuário"]');
    } else if (services.length > 0) {
      lines.push(`  B --> D["${services[0].name}"]`);
      if (repos.length > 0) {
        lines.push(`  D --> E["${repos[0].name}"]`);
        lines.push('  E --> F[("Banco de Dados")]');
        lines.push('  F --> E');
        lines.push('  E --> D');
      }
      lines.push('  D --> G["Resposta ao Usuário"]');
    }

    // Style new components
    for (const comp of sol.proposedComponents.filter((c) => c.isNew)) {
      const letter = comp.type === 'controller' ? 'C'
        : comp.type === 'service' ? 'D'
          : comp.type === 'repository' ? 'E' : '';
      if (letter) {
        lines.push(`  style ${letter} fill:#e1f5fe,stroke:#0288d1`);
      }
    }

    return {
      mermaidCode: lines.join('\n'),
      title: `Fluxo Principal — ${feature}`,
      description: 'Fluxograma do fluxo principal da funcionalidade, desde a requisição do usuário até a persistência e resposta.',
      type: 'flowchart',
    };
  }

  private buildSequenceDiagram(sol: SolutionArchitecture): FlowchartOutput {
    const lines: string[] = ['sequenceDiagram'];
    lines.push('  actor Usuário');

    const controller = sol.proposedComponents.find((c) => c.type === 'controller');
    const service = sol.proposedComponents.find((c) => c.type === 'service');
    const repo = sol.proposedComponents.find((c) => c.type === 'repository');

    const ctrlName = controller?.name ?? 'Controller';
    const svcName = service?.name ?? 'Service';
    const repoName = repo?.name ?? 'Repository';

    lines.push(`  participant ${ctrlName}`);
    lines.push(`  participant ${svcName}`);
    lines.push(`  participant ${repoName}`);
    lines.push('  participant DB as Banco de Dados');
    lines.push('');
    lines.push(`  Usuário->>${ctrlName}: Requisição HTTP`);
    lines.push(`  ${ctrlName}->>${svcName}: Processa regras de negócio`);
    lines.push(`  ${svcName}->>${repoName}: Persiste dados`);
    lines.push(`  ${repoName}->>DB: Query SQL`);
    lines.push(`  DB-->>${repoName}: Resultado`);
    lines.push(`  ${repoName}-->>${svcName}: Entidade`);
    lines.push(`  ${svcName}-->>${ctrlName}: DTO de resposta`);
    lines.push(`  ${ctrlName}->>Usuário: HTTP Response`);

    return {
      mermaidCode: lines.join('\n'),
      title: 'Diagrama de Sequência',
      description: 'Interação entre componentes durante o processamento da requisição.',
      type: 'sequence',
    };
  }

  private buildClassDiagram(sol: SolutionArchitecture): FlowchartOutput {
    const lines: string[] = ['classDiagram'];

    for (const comp of sol.proposedComponents) {
      const className = comp.name.replace(/\s+/g, '');
      lines.push(`  class ${className} {`);
      lines.push(`    +${comp.type}`);
      const desc = comp.description.length > 60 ? comp.description.substring(0, 60) + '…' : comp.description;
      lines.push(`    +${desc}`);
      lines.push('  }');
    }

    for (const int of sol.integrations) {
      const src = int.source.replace(/\s+/g, '');
      const tgt = int.target.replace(/\s+/g, '');
      lines.push(`  ${src} --> ${tgt} : ${int.type}`);
    }

    return {
      mermaidCode: lines.join('\n'),
      title: 'Diagrama de Classes',
      description: 'Componentes propostos e suas relações de dependência.',
      type: 'class',
    };
  }
}
