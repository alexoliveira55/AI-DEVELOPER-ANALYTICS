import * as fs from 'fs';
import * as path from 'path';
import { BaseAgent } from '../core';
import { Labels } from '../config';
import {
  AgentRole,
  FeatureContext,
  ProposedComponent,
  PrototypeOutput,
  RepoIndex,
  SessionContext,
  SolutionArchitecture,
} from '../types';
import { RepositoryContext } from '../indexer';

/**
 * Generates framework-aware, idiomatic scaffold files for a proposed feature.
 * Detects the repository's framework (NestJS, Express, etc.) and produces
 * code that matches existing naming conventions, import styles, and
 * architectural patterns. Generates services, controllers, repositories,
 * DTOs, migrations, tests, and a README.
 */
export class PrototypeGeneratorAgent extends BaseAgent<FeatureContext, PrototypeOutput> {
  readonly role = AgentRole.PrototypeGenerator;
  readonly name = 'Prototype Generator';

  protected async run(fc: FeatureContext, context: SessionContext): Promise<PrototypeOutput> {
    const repoIndex = fc.repoIndex;
    const repo = fc.repositoryContext;
    const featureDescription = fc.rawRequirements ?? 'feature';
    const solutionArchitecture = fc.solutionArchitecture;
    const primaryLanguage = repoIndex
      ? this.detectPrimaryLanguage(repoIndex)
      : repo
        ? repo.languages.sort((a, b) => b.lines - a.lines)[0]?.language ?? 'TypeScript'
        : 'TypeScript';

    const framework = this.detectFramework(repo);

    const files = solutionArchitecture
      ? this.generateFromArchitecture(solutionArchitecture, primaryLanguage, framework, repo)
      : this.generateScaffold(featureDescription, primaryLanguage, framework);

    const outDir = path.join(context.config.output.dir, 'prototype');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    for (const file of files) {
      const filePath = path.join(outDir, file.path);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, file.content, 'utf-8');
    }

    this.logger.info(`Prototype generated with ${files.length} file(s) in ${outDir}`);
    return { files };
  }

  private detectPrimaryLanguage(repoIndex: RepoIndex): string {
    let max = 0;
    let primary = 'TypeScript';
    for (const [lang, lines] of Object.entries(repoIndex.languages)) {
      if (lines > max) { max = lines; primary = lang; }
    }
    return primary;
  }

  private detectFramework(repo?: RepositoryContext): string {
    if (!repo) return 'generic';
    const fwNames = repo.frameworks.map((f) => f.name.toLowerCase());
    if (fwNames.some((f) => f.includes('nestjs') || f.includes('nest'))) return 'nestjs';
    if (fwNames.some((f) => f.includes('express'))) return 'express';
    if (fwNames.some((f) => f.includes('fastify'))) return 'fastify';
    if (fwNames.some((f) => f.includes('spring'))) return 'spring';
    if (fwNames.some((f) => f.includes('django'))) return 'django';
    if (fwNames.some((f) => f.includes('flask'))) return 'flask';
    if (fwNames.some((f) => f.includes('asp.net') || f.includes('dotnet'))) return 'dotnet';
    return 'generic';
  }

  private kebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  private camelCase(str: string): string {
    return str.replace(/(^|[-_])(\w)/g, (_, _s, c) => c.toUpperCase())
      .replace(/^(.)/, (c) => c.toLowerCase());
  }

  private ext(language: string): string {
    if (language === 'TypeScript') return '.ts';
    if (language === 'Python') return '.py';
    if (language === 'C#') return '.cs';
    if (language === 'Java') return '.java';
    return '.js';
  }

  // ── Scaffold from description only ──────────────────────
  private generateScaffold(
    description: string,
    language: string,
    framework: string,
  ): { path: string; content: string }[] {
    const e = this.ext(language);
    const featureName = description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40);
    const className = featureName.replace(/(^|-)(\w)/g, (_, _s, c) => c.toUpperCase());

    const files: { path: string; content: string }[] = [];

    if (framework === 'nestjs') {
      files.push({
        path: `${featureName}/${featureName}.module${e}`,
        content: [
          `import { Module } from '@nestjs/common';`,
          `import { ${className}Controller } from './${featureName}.controller';`,
          `import { ${className}Service } from './${featureName}.service';`,
          '',
          `@Module({`,
          `  controllers: [${className}Controller],`,
          `  providers: [${className}Service],`,
          `  exports: [${className}Service],`,
          `})`,
          `export class ${className}Module {}`,
          '',
        ].join('\n'),
      });
      files.push({
        path: `${featureName}/${featureName}.service${e}`,
        content: [
          `import { Injectable } from '@nestjs/common';`,
          '',
          `@Injectable()`,
          `export class ${className}Service {`,
          `  // TODO: implement ${description}`,
          '}',
          '',
        ].join('\n'),
      });
      files.push({
        path: `${featureName}/${featureName}.controller${e}`,
        content: [
          `import { Controller, Get } from '@nestjs/common';`,
          `import { ${className}Service } from './${featureName}.service';`,
          '',
          `@Controller('${featureName}')`,
          `export class ${className}Controller {`,
          `  constructor(private readonly ${this.camelCase(className)}Service: ${className}Service) {}`,
          '',
          `  @Get()`,
          `  findAll() {`,
          `    // TODO: implement`,
          `    return [];`,
          `  }`,
          '}',
          '',
        ].join('\n'),
      });
    } else {
      files.push({
        path: `${featureName}/index${e}`,
        content: [
          `// Prototype: ${description}`,
          `// Language: ${language}`,
          '',
          `export class ${className}Service {`,
          `  // TODO: implement ${description}`,
          '}',
          '',
        ].join('\n'),
      });
    }

    files.push({
      path: `${featureName}/README.md`,
      content: [
        `# ${description}`,
        '',
        `## ${Labels.prototype.description}`,
        Labels.prototype.readmeDescription(description),
        '',
        `**${Labels.prototype.frameworkLabel}**: ${framework}`,
        `**${Labels.prototype.languageLabel}**: ${language}`,
        '',
        `## ${Labels.prototype.statusLabel}`,
        ...Labels.prototype.statusChecklist.map((s) => `- [ ] ${s}`),
        '',
      ].join('\n'),
    });

    return files;
  }

  // ── Architecture-driven generation ──────────────────────
  private generateFromArchitecture(
    solution: SolutionArchitecture,
    language: string,
    framework: string,
    repo?: RepositoryContext,
  ): { path: string; content: string }[] {
    const e = this.ext(language);
    const files: { path: string; content: string }[] = [];
    const newComps = solution.proposedComponents.filter((c) => c.isNew);

    for (const comp of newComps) {
      const content = this.generateComponentFile(comp, language, framework, e, repo);
      if (content) files.push(content);
    }

    // Generate test files for services and controllers
    const testableComps = newComps.filter((c) => c.type === 'service' || c.type === 'controller');
    for (const comp of testableComps) {
      const testFile = this.generateTestFile(comp, language, framework, e);
      if (testFile) files.push(testFile);
    }

    // Generate index/barrel file
    if (newComps.length > 0 && (language === 'TypeScript' || language === 'JavaScript')) {
      const exports = newComps
        .filter((c) => c.type !== 'migration')
        .map((c) => {
          const fileName = this.kebabCase(c.name);
          return `export { ${c.name} } from './${c.type}/${fileName}';`;
        });
      files.push({
        path: `index${e}`,
        content: exports.join('\n') + '\n',
      });
    }

    // README with architecture overview
    files.push({
      path: 'README.md',
      content: this.generateReadme(solution, framework, language),
    });

    return files;
  }

  private generateComponentFile(
    comp: ProposedComponent,
    language: string,
    framework: string,
    e: string,
    repo?: RepositoryContext,
  ): { path: string; content: string } | null {
    const fileName = this.kebabCase(comp.name);
    const folder = comp.type;

    if (framework === 'nestjs' && language === 'TypeScript') {
      return this.generateNestJsComponent(comp, fileName, folder, e, repo);
    }

    if (framework === 'express' && (language === 'TypeScript' || language === 'JavaScript')) {
      return this.generateExpressComponent(comp, fileName, folder, e);
    }

    // Generic TypeScript/JavaScript
    return this.generateGenericComponent(comp, fileName, folder, language, e);
  }

  private generateNestJsComponent(
    comp: ProposedComponent,
    fileName: string,
    folder: string,
    e: string,
    repo?: RepositoryContext,
  ): { path: string; content: string } {
    const lines: string[] = [];

    switch (comp.type) {
      case 'service': {
        const depImports = comp.dependencies.map((d) => {
          const depFile = this.kebabCase(d);
          return `import { ${d} } from '../${this.guessFolder(d)}/${depFile}';`;
        });
        lines.push(`import { Injectable } from '@nestjs/common';`);
        lines.push(...depImports);
        lines.push('');
        lines.push(`@Injectable()`);
        lines.push(`export class ${comp.name} {`);
        if (comp.dependencies.length > 0) {
          lines.push(`  constructor(`);
          for (const dep of comp.dependencies) {
            lines.push(`    private readonly ${this.camelCase(dep)}: ${dep},`);
          }
          lines.push(`  ) {}`);
        }
        lines.push('');
        lines.push(`  async findAll(): Promise<any[]> {`);
        lines.push(`    // TODO: ${comp.description}`);
        lines.push(`    return [];`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  async findOne(id: string): Promise<any> {`);
        lines.push(`    // TODO: implement find by id`);
        lines.push(`    return { id };`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  async create(dto: any): Promise<any> {`);
        lines.push(`    // TODO: implement create`);
        lines.push(`    return { ...dto };`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  async update(id: string, dto: any): Promise<any> {`);
        lines.push(`    // TODO: implement update`);
        lines.push(`    return { id, ...dto };`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  async remove(id: string): Promise<void> {`);
        lines.push(`    // TODO: implement delete`);
        lines.push(`  }`);
        lines.push('}');
        break;
      }

      case 'controller': {
        const svcDep = comp.dependencies[0];
        const svcFile = svcDep ? this.kebabCase(svcDep) : '';
        lines.push(`import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';`);
        if (svcDep) {
          lines.push(`import { ${svcDep} } from '../service/${svcFile}';`);
        }
        lines.push('');
        const routeName = comp.name.replace(/Controller$/i, '').toLowerCase() + 's';
        lines.push(`@Controller('${routeName}')`);
        lines.push(`export class ${comp.name} {`);
        if (svcDep) {
          lines.push(`  constructor(private readonly ${this.camelCase(svcDep)}: ${svcDep}) {}`);
        }
        lines.push('');
        lines.push(`  @Get()`);
        lines.push(`  findAll() {`);
        lines.push(`    return ${svcDep ? `this.${this.camelCase(svcDep)}.findAll()` : '[]'};`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  @Get(':id')`);
        lines.push(`  findOne(@Param('id') id: string) {`);
        lines.push(`    return ${svcDep ? `this.${this.camelCase(svcDep)}.findOne(id)` : '{ id }'};`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  @Post()`);
        lines.push(`  create(@Body() dto: any) {`);
        lines.push(`    return ${svcDep ? `this.${this.camelCase(svcDep)}.create(dto)` : 'dto'};`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  @Put(':id')`);
        lines.push(`  update(@Param('id') id: string, @Body() dto: any) {`);
        lines.push(`    return ${svcDep ? `this.${this.camelCase(svcDep)}.update(id, dto)` : '{ id, ...dto }'};`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  @Delete(':id')`);
        lines.push(`  remove(@Param('id') id: string) {`);
        lines.push(`    return ${svcDep ? `this.${this.camelCase(svcDep)}.remove(id)` : 'undefined'};`);
        lines.push(`  }`);
        lines.push('}');
        break;
      }

      case 'repository': {
        lines.push(`import { Injectable } from '@nestjs/common';`);
        lines.push('');
        lines.push(`@Injectable()`);
        lines.push(`export class ${comp.name} {`);
        lines.push(`  // TODO: inject ORM repository or data source`);
        lines.push('');
        lines.push(`  async findAll(): Promise<any[]> {`);
        lines.push(`    // TODO: implement query`);
        lines.push(`    return [];`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  async findById(id: string): Promise<any | null> {`);
        lines.push(`    // TODO: implement find`);
        lines.push(`    return null;`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  async save(entity: any): Promise<any> {`);
        lines.push(`    // TODO: implement save`);
        lines.push(`    return entity;`);
        lines.push(`  }`);
        lines.push('');
        lines.push(`  async delete(id: string): Promise<void> {`);
        lines.push(`    // TODO: implement delete`);
        lines.push(`  }`);
        lines.push('}');
        break;
      }

      case 'model': {
        const entityName = comp.name;
        lines.push(`// Entity/Model: ${comp.description}`);
        lines.push('');
        lines.push(`export interface ${entityName} {`);
        lines.push(`  id: string;`);
        lines.push(`  // TODO: add fields based on database schema`);
        lines.push(`  createdAt: Date;`);
        lines.push(`  updatedAt: Date;`);
        lines.push('}');
        break;
      }

      case 'middleware': {
        lines.push(`import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';`);
        lines.push('');
        lines.push(`@Injectable()`);
        lines.push(`export class ${comp.name} implements CanActivate {`);
        lines.push(`  canActivate(context: ExecutionContext): boolean {`);
        lines.push(`    // TODO: ${comp.description}`);
        lines.push(`    const request = context.switchToHttp().getRequest();`);
        lines.push(`    return !!request.headers.authorization;`);
        lines.push(`  }`);
        lines.push('}');
        break;
      }

      case 'utility': {
        // DTO
        lines.push(`import { IsNotEmpty, IsOptional, IsString } from 'class-validator';`);
        lines.push('');
        lines.push(`export class ${comp.name} {`);
        lines.push(`  @IsNotEmpty()`);
        lines.push(`  @IsString()`);
        lines.push(`  name!: string;`);
        lines.push('');
        lines.push(`  @IsOptional()`);
        lines.push(`  @IsString()`);
        lines.push(`  description?: string;`);
        lines.push(`  // TODO: add fields based on requirements`);
        lines.push('}');
        break;
      }

      case 'migration': {
        lines.push(`// Migration: ${comp.description}`);
        lines.push(`// Run this migration before deploying the feature`);
        lines.push('');
        lines.push(`export async function up(queryRunner: any): Promise<void> {`);
        lines.push(`  // TODO: implement migration`);
        lines.push(`  // await queryRunner.query(\`CREATE TABLE ...\`);`);
        lines.push('}');
        lines.push('');
        lines.push(`export async function down(queryRunner: any): Promise<void> {`);
        lines.push(`  // TODO: implement rollback`);
        lines.push(`  // await queryRunner.query(\`DROP TABLE ...\`);`);
        lines.push('}');
        break;
      }

      default:
        lines.push(`// ${comp.description}`);
        lines.push(`export class ${comp.name} {`);
        lines.push(`  // TODO: implement`);
        lines.push('}');
    }

    lines.push('');
    return { path: `${folder}/${fileName}${e}`, content: lines.join('\n') };
  }

  private generateExpressComponent(
    comp: ProposedComponent,
    fileName: string,
    folder: string,
    e: string,
  ): { path: string; content: string } {
    const lines: string[] = [];

    switch (comp.type) {
      case 'controller': {
        const routeName = comp.name.replace(/Controller$/i, '').toLowerCase() + 's';
        lines.push(`import { Router, Request, Response } from 'express';`);
        lines.push('');
        lines.push(`const router = Router();`);
        lines.push('');
        lines.push(`router.get('/${routeName}', async (_req: Request, res: Response) => {`);
        lines.push(`  // TODO: implement list`);
        lines.push(`  res.json([]);`);
        lines.push(`});`);
        lines.push('');
        lines.push(`router.get('/${routeName}/:id', async (req: Request, res: Response) => {`);
        lines.push(`  // TODO: implement get by id`);
        lines.push(`  res.json({ id: req.params.id });`);
        lines.push(`});`);
        lines.push('');
        lines.push(`router.post('/${routeName}', async (req: Request, res: Response) => {`);
        lines.push(`  // TODO: implement create`);
        lines.push(`  res.status(201).json(req.body);`);
        lines.push(`});`);
        lines.push('');
        lines.push(`export default router;`);
        break;
      }

      case 'service': {
        lines.push(`// ${comp.description}`);
        lines.push('');
        lines.push(`export class ${comp.name} {`);
        if (comp.dependencies.length > 0) {
          lines.push(`  constructor(`);
          for (const dep of comp.dependencies) {
            lines.push(`    private readonly ${this.camelCase(dep)}: ${dep},`);
          }
          lines.push(`  ) {}`);
        }
        lines.push('');
        lines.push(`  async findAll() { return []; }`);
        lines.push(`  async findOne(id: string) { return { id }; }`);
        lines.push(`  async create(data: any) { return { ...data }; }`);
        lines.push(`  async update(id: string, data: any) { return { id, ...data }; }`);
        lines.push(`  async remove(id: string) { /* TODO */ }`);
        lines.push('}');
        break;
      }

      default:
        lines.push(`// ${comp.description}`);
        lines.push(`export class ${comp.name} {`);
        lines.push(`  // TODO: implement`);
        lines.push('}');
    }

    lines.push('');
    return { path: `${folder}/${fileName}${e}`, content: lines.join('\n') };
  }

  private generateGenericComponent(
    comp: ProposedComponent,
    fileName: string,
    folder: string,
    language: string,
    e: string,
  ): { path: string; content: string } {
    const lines: string[] = [];
    lines.push(`// ${comp.description}`);
    lines.push(`// Type: ${comp.type}`);
    lines.push(`// Dependencies: ${comp.dependencies.join(', ') || 'none'}`);
    lines.push('');

    if (language === 'TypeScript' || language === 'JavaScript') {
      if (comp.dependencies.length > 0) {
        for (const dep of comp.dependencies) {
          const depFile = this.kebabCase(dep);
          lines.push(`import { ${dep} } from '../${this.guessFolder(dep)}/${depFile}';`);
        }
        lines.push('');
      }
      lines.push(`export class ${comp.name} {`);
      if (comp.dependencies.length > 0) {
        lines.push(`  constructor(`);
        for (const dep of comp.dependencies) {
          lines.push(`    private readonly ${this.camelCase(dep)}: ${dep},`);
        }
        lines.push(`  ) {}`);
      }
      lines.push('');
      lines.push(`  // TODO: implement ${comp.description}`);
      lines.push('}');
    } else {
      lines.push(`class ${comp.name}:`);
      lines.push(`    """${comp.description}"""`);
      lines.push('');
      lines.push(`    def __init__(self):`);
      lines.push(`        # TODO: implement`);
      lines.push(`        pass`);
    }

    lines.push('');
    return { path: `${folder}/${fileName}${e}`, content: lines.join('\n') };
  }

  private generateTestFile(
    comp: ProposedComponent,
    language: string,
    framework: string,
    e: string,
  ): { path: string; content: string } | null {
    if (language !== 'TypeScript' && language !== 'JavaScript') return null;

    const fileName = this.kebabCase(comp.name);
    const testExt = e.replace('.ts', '.spec.ts').replace('.js', '.spec.js');
    const lines: string[] = [];

    lines.push(`import { ${comp.name} } from '../${comp.type}/${fileName}';`);

    if (framework === 'nestjs') {
      lines.push(`import { Test, TestingModule } from '@nestjs/testing';`);
      lines.push('');
      lines.push(`describe('${comp.name}', () => {`);
      lines.push(`  let instance: ${comp.name};`);
      lines.push('');
      lines.push(`  beforeEach(async () => {`);
      lines.push(`    const module: TestingModule = await Test.createTestingModule({`);
      lines.push(`      providers: [${comp.name}],`);
      lines.push(`    }).compile();`);
      lines.push('');
      lines.push(`    instance = module.get<${comp.name}>(${comp.name});`);
      lines.push(`  });`);
      lines.push('');
      lines.push(`  it('should be defined', () => {`);
      lines.push(`    expect(instance).toBeDefined();`);
      lines.push(`  });`);
      lines.push('');
      lines.push(`  // TODO: add tests for ${comp.description}`);
      lines.push(`});`);
    } else {
      lines.push('');
      lines.push(`describe('${comp.name}', () => {`);
      lines.push(`  let instance: ${comp.name};`);
      lines.push('');
      lines.push(`  beforeEach(() => {`);
      lines.push(`    instance = new ${comp.name}();`);
      lines.push(`  });`);
      lines.push('');
      lines.push(`  it('should be defined', () => {`);
      lines.push(`    expect(instance).toBeDefined();`);
      lines.push(`  });`);
      lines.push('');
      lines.push(`  // TODO: add tests for ${comp.description}`);
      lines.push(`});`);
    }

    lines.push('');
    return { path: `test/${fileName}${testExt}`, content: lines.join('\n') };
  }

  private generateReadme(
    solution: SolutionArchitecture,
    framework: string,
    language: string,
  ): string {
    const lines: string[] = [];

    lines.push(`# ${solution.overview}`);
    lines.push('');
    lines.push(`> ${Labels.prototype.frameworkLabel}: **${framework}** | ${Labels.prototype.languageLabel}: **${language}**`);
    lines.push('');
    lines.push(`## ${Labels.prototype.components}`);
    lines.push('');
    lines.push(`| ${Labels.common.component} | ${Labels.common.type} | ${Labels.prototype.statusLabel} | ${Labels.common.description} |`);
    lines.push('|-----------|------|--------|-------------|');
    for (const c of solution.proposedComponents) {
      lines.push(`| ${c.name} | ${c.type} | ${c.isNew ? `🆕 ${Labels.common.new}` : `✏️ ${Labels.common.modified}`} | ${c.description} |`);
    }
    lines.push('');

    if (solution.dataFlows.length > 0) {
      lines.push(`## ${Labels.prototype.dataFlowTitle}`);
      lines.push('');
      lines.push('```mermaid');
      lines.push('sequenceDiagram');
      for (const df of solution.dataFlows) {
        const from = df.from.replace(/[^a-zA-Z0-9]/g, '');
        const to = df.to.replace(/[^a-zA-Z0-9]/g, '');
        lines.push(`    ${from}->>+${to}: ${df.data}`);
      }
      lines.push('```');
      lines.push('');
    }

    lines.push(`## ${Labels.solution.technologyStack}`);
    lines.push('');
    for (const t of solution.technologyStack) lines.push(`- ${t}`);
    lines.push('');
    lines.push(`## ${Labels.prototype.gettingStarted}`);
    lines.push('');
    lines.push(`1. ${Labels.prototype.installDeps}`);
    lines.push(`2. ${Labels.prototype.runTests}`);
    lines.push(`3. ${Labels.prototype.startDev}`);
    lines.push('');

    return lines.join('\n');
  }

  private guessFolder(depName: string): string {
    if (/service$/i.test(depName)) return 'service';
    if (/repository$/i.test(depName)) return 'repository';
    if (/controller$/i.test(depName)) return 'controller';
    if (/guard$/i.test(depName)) return 'middleware';
    return 'utility';
  }
}

