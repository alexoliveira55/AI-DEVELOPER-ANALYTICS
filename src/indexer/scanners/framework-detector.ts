import * as fs from 'fs';
import * as path from 'path';
import { FrameworkDetection, ScannedFile } from '../types';

interface FrameworkRule {
  name: string;
  detect: (files: ScannedFile[], rootPath: string) => { detected: boolean; version?: string; evidence: string };
}

const rules: FrameworkRule[] = [
  // ── JavaScript / TypeScript ────────────────────────
  {
    name: 'Next.js',
    detect: (_f, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['next'] ?? pkg?.devDependencies?.['next'];
      return { detected: !!dep, version: dep, evidence: 'next in package.json' };
    },
  },
  {
    name: 'React',
    detect: (_f, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['react'] ?? pkg?.devDependencies?.['react'];
      return { detected: !!dep, version: dep, evidence: 'react in package.json' };
    },
  },
  {
    name: 'Angular',
    detect: (_f, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['@angular/core'] ?? pkg?.devDependencies?.['@angular/core'];
      return { detected: !!dep, version: dep, evidence: '@angular/core in package.json' };
    },
  },
  {
    name: 'Vue.js',
    detect: (files, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['vue'] ?? pkg?.devDependencies?.['vue'];
      const hasVueFiles = files.some((f) => f.extension === '.vue');
      return { detected: !!(dep || hasVueFiles), version: dep, evidence: dep ? 'vue in package.json' : '.vue files detected' };
    },
  },
  {
    name: 'Svelte',
    detect: (files, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['svelte'] ?? pkg?.devDependencies?.['svelte'];
      const hasSvelteFiles = files.some((f) => f.extension === '.svelte');
      return { detected: !!(dep || hasSvelteFiles), version: dep, evidence: 'svelte detected' };
    },
  },
  {
    name: 'NestJS',
    detect: (_f, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['@nestjs/core'] ?? pkg?.devDependencies?.['@nestjs/core'];
      return { detected: !!dep, version: dep, evidence: '@nestjs/core in package.json' };
    },
  },
  {
    name: 'Express',
    detect: (_f, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['express'] ?? pkg?.devDependencies?.['express'];
      return { detected: !!dep, version: dep, evidence: 'express in package.json' };
    },
  },
  {
    name: 'Fastify',
    detect: (_f, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['fastify'] ?? pkg?.devDependencies?.['fastify'];
      return { detected: !!dep, version: dep, evidence: 'fastify in package.json' };
    },
  },
  {
    name: 'Prisma',
    detect: (files, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['prisma'] ?? pkg?.devDependencies?.['prisma'];
      const hasPrisma = files.some((f) => f.extension === '.prisma');
      return { detected: !!(dep || hasPrisma), version: dep, evidence: 'prisma detected' };
    },
  },
  {
    name: 'TypeORM',
    detect: (_f, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['typeorm'] ?? pkg?.devDependencies?.['typeorm'];
      return { detected: !!dep, version: dep, evidence: 'typeorm in package.json' };
    },
  },
  {
    name: 'Sequelize',
    detect: (_f, root) => {
      const pkg = readPkg(root);
      const dep = pkg?.dependencies?.['sequelize'] ?? pkg?.devDependencies?.['sequelize'];
      return { detected: !!dep, version: dep, evidence: 'sequelize in package.json' };
    },
  },
  // ── Python ─────────────────────────────────────────
  {
    name: 'Django',
    detect: (files) => {
      const pyFiles = files.filter((f) => f.language === 'Python');
      const found = pyFiles.some((f) =>
        /^(?:from|import)\s+django\b/m.test(f.content) || f.relativePath.endsWith('manage.py'));
      return { detected: found, evidence: 'django imports or manage.py found' };
    },
  },
  {
    name: 'Flask',
    detect: (files) => {
      const pyFiles = files.filter((f) => f.language === 'Python');
      const found = pyFiles.some((f) => /^(?:from|import)\s+flask\b/m.test(f.content));
      return { detected: found, evidence: 'flask imports found' };
    },
  },
  {
    name: 'FastAPI',
    detect: (files) => {
      const pyFiles = files.filter((f) => f.language === 'Python');
      const found = pyFiles.some((f) => /^(?:from|import)\s+fastapi\b/m.test(f.content));
      return { detected: found, evidence: 'fastapi imports found' };
    },
  },
  // ── Java / Kotlin ──────────────────────────────────
  {
    name: 'Spring Boot',
    detect: (files) => {
      const jvmFiles = files.filter((f) => f.language === 'Java' || f.language === 'Kotlin');
      const found = jvmFiles.some((f) =>
        f.content.includes('@SpringBootApplication') || f.content.includes('org.springframework'));
      return { detected: found, evidence: 'Spring Boot annotations found' };
    },
  },
  // ── C# ─────────────────────────────────────────────
  {
    name: 'ASP.NET Core',
    detect: (files) => {
      const csFiles = files.filter((f) => f.language === 'C#');
      const found = csFiles.some((f) =>
        f.content.includes('Microsoft.AspNetCore') || f.content.includes('WebApplication.CreateBuilder'));
      return { detected: found, evidence: 'ASP.NET Core references found' };
    },
  },
  {
    name: 'Entity Framework',
    detect: (files) => {
      const csFiles = files.filter((f) => f.language === 'C#');
      const found = csFiles.some((f) =>
        f.content.includes('Microsoft.EntityFrameworkCore') || f.content.includes('DbContext'));
      return { detected: found, evidence: 'Entity Framework references found' };
    },
  },
  // ── Go ─────────────────────────────────────────────
  {
    name: 'Gin',
    detect: (files) => {
      const goFiles = files.filter((f) => f.language === 'Go');
      const found = goFiles.some((f) => f.content.includes('"github.com/gin-gonic/gin"'));
      return { detected: found, evidence: 'gin import found' };
    },
  },
  // ── Docker / Infra ─────────────────────────────────
  {
    name: 'Docker',
    detect: (files) => {
      const found = files.some((f) => f.language === 'Docker' || f.relativePath.includes('docker-compose'));
      return { detected: found, evidence: 'Dockerfile or docker-compose found' };
    },
  },
  {
    name: 'Terraform',
    detect: (files) => {
      const found = files.some((f) => f.extension === '.tf');
      return { detected: found, evidence: '.tf files found' };
    },
  },
];

export function detectFrameworks(files: ScannedFile[], rootPath: string): FrameworkDetection[] {
  const results: FrameworkDetection[] = [];

  for (const rule of rules) {
    const { detected, version, evidence } = rule.detect(files, rootPath);
    if (detected) {
      results.push({
        name: rule.name,
        version,
        confidence: version ? 'high' : 'medium',
        evidence,
      });
    }
  }

  return results;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readPkg(rootPath: string): Record<string, Record<string, string>> | undefined {
  const pkgPath = path.join(rootPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return undefined;
  }
}
