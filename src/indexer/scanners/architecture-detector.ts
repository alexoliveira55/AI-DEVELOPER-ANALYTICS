import { ArchitecturePattern, ScannedFile } from '../types';

interface PatternSignal {
  pattern: string;
  test: (files: ScannedFile[]) => boolean;
  evidence: string;
}

const signals: PatternSignal[] = [
  // Clean / Hexagonal Architecture
  {
    pattern: 'Clean Architecture',
    test: (files) => {
      const dirs = uniqueDirs(files);
      const hasLayers = ['domain', 'application', 'infrastructure'].filter((d) =>
        dirs.some((p) => p.includes(d)),
      );
      return hasLayers.length >= 2;
    },
    evidence: 'domain/application/infrastructure layers found',
  },
  {
    pattern: 'Hexagonal Architecture',
    test: (files) => {
      const dirs = uniqueDirs(files);
      return dirs.some((d) => d.includes('port')) && dirs.some((d) => d.includes('adapter'));
    },
    evidence: 'ports and adapters directories found',
  },
  // MVC
  {
    pattern: 'MVC',
    test: (files) => {
      const dirs = uniqueDirs(files);
      const mvc = ['controller', 'model', 'view'].filter((k) =>
        dirs.some((d) => d.includes(k)),
      );
      return mvc.length >= 2;
    },
    evidence: 'controller/model/view directories found',
  },
  // Layered / N-Tier
  {
    pattern: 'Layered Architecture',
    test: (files) => {
      const dirs = uniqueDirs(files);
      const layers = ['service', 'repository', 'controller'].filter((k) =>
        dirs.some((d) => d.includes(k)),
      );
      return layers.length >= 2;
    },
    evidence: 'service/repository/controller layers detected',
  },
  // CQRS
  {
    pattern: 'CQRS',
    test: (files) => {
      const dirs = uniqueDirs(files);
      return dirs.some((d) => d.includes('command')) && dirs.some((d) => d.includes('query'));
    },
    evidence: 'command/query separation found',
  },
  // Microservices
  {
    pattern: 'Microservices',
    test: (files) => {
      const dirs = uniqueDirs(files);
      const hasMultiServices = dirs.filter((d) => /^services\/[^/]+$/.test(d)).length > 1;
      const hasDockerCompose = files.some((f) => f.relativePath.includes('docker-compose'));
      return hasMultiServices || hasDockerCompose;
    },
    evidence: 'multiple service directories or docker-compose detected',
  },
  // Monorepo
  {
    pattern: 'Monorepo',
    test: (files) => {
      const dirs = uniqueDirs(files);
      return (
        dirs.some((d) => d.startsWith('packages/')) ||
        dirs.some((d) => d.startsWith('apps/')) ||
        files.some((f) => f.relativePath === 'lerna.json' || f.relativePath.includes('turbo.json'))
      );
    },
    evidence: 'packages/ or apps/ directories or monorepo config found',
  },
  // Event-driven
  {
    pattern: 'Event-Driven',
    test: (files) => {
      return files.some(
        (f) =>
          f.content.includes('EventEmitter') ||
          f.content.includes('@EventPattern') ||
          f.content.includes('event-bus') ||
          f.content.includes('EventBus'),
      );
    },
    evidence: 'EventEmitter or event bus patterns found in code',
  },
  // Module-based (NestJS-style)
  {
    pattern: 'Module-Based',
    test: (files) => {
      return files.filter((f) => f.relativePath.includes('.module.')).length >= 2;
    },
    evidence: 'multiple .module. files found',
  },
  // VFP Classic (PRG + forms converted to XML)
  {
    pattern: 'VFP Classic',
    test: (files) => {
      const hasVfp = files.some((f) => f.language === 'Visual FoxPro');
      const hasPrg = files.some((f) => f.extension === '.prg');
      return hasVfp || hasPrg;
    },
    evidence: 'Visual FoxPro .prg files and/or converted form XML files detected',
  },
];

export function detectArchitecture(files: ScannedFile[]): ArchitecturePattern {
  const detected: { pattern: string; evidence: string }[] = [];

  for (const signal of signals) {
    if (signal.test(files)) {
      detected.push({ pattern: signal.pattern, evidence: signal.evidence });
    }
  }

  const primary = detected[0]?.pattern ?? 'Unknown';

  return {
    primary,
    patterns: detected.map((d) => d.pattern),
    evidence: detected.map((d) => d.evidence),
  };
}

function uniqueDirs(files: ScannedFile[]): string[] {
  const set = new Set<string>();
  for (const f of files) {
    const dir = f.relativePath.replace(/\/[^/]+$/, '');
    if (dir !== f.relativePath) set.add(dir);
  }
  return Array.from(set);
}
