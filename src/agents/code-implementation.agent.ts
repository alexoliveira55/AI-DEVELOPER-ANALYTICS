import * as fs from 'fs';
import * as path from 'path';
import { BaseAgent } from '../core';
import {
  AgentRole,
  FeatureContext,
  ImplementationFile,
  ImplementationOutput,
  ProposedComponent,
  SessionContext,
} from '../types';

/**
 * Language-to-prompt mapping for implementation generation.
 * Keys are lowercase language/framework identifiers.
 */
const LANGUAGE_PROMPT_MAP: Record<string, string> = {
  angular: 'implementation-angular-agent.txt',
  'c#': 'implementation-csharp-dotnet-agent.txt',
  '.net': 'implementation-csharp-dotnet-agent.txt',
  csharp: 'implementation-csharp-dotnet-agent.txt',
  python: 'implementation-python-agent.txt',
  sql: 'implementation-sql-agent.txt',
  flutter: 'implementation-flutter-dart-agent.txt',
  dart: 'implementation-flutter-dart-agent.txt',
  html: 'implementation-web-agent.txt',
  css: 'implementation-web-agent.txt',
  javascript: 'implementation-web-agent.txt',
  foxpro: 'implementation-visual-foxpro-agent.txt',
  'visual foxpro': 'implementation-visual-foxpro-agent.txt',
};

/** File extension mapping per detected language. */
const LANGUAGE_EXT_MAP: Record<string, string> = {
  angular: 'ts',
  typescript: 'ts',
  'c#': 'cs',
  '.net': 'cs',
  csharp: 'cs',
  python: 'py',
  sql: 'sql',
  flutter: 'dart',
  dart: 'dart',
  html: 'html',
  css: 'css',
  javascript: 'js',
  foxpro: 'prg',
  'visual foxpro': 'prg',
  java: 'java',
  go: 'go',
  rust: 'rs',
  php: 'php',
  ruby: 'rb',
};

/**
 * Generates production-ready code implementation based on the full
 * pipeline analysis context. Delegates to language-specific prompt
 * templates and produces files for every proposed new component.
 *
 * **Requires LLM** for quality output. Offline fallback generates
 * structural scaffolds only.
 */
export class CodeImplementationAgent extends BaseAgent<FeatureContext, ImplementationOutput> {
  readonly role = AgentRole.CodeImplementation;
  readonly name = 'Code Implementation';

  protected async run(fc: FeatureContext, ctx: SessionContext): Promise<ImplementationOutput> {
    const { language, framework } = this.detectPrimaryLanguage(fc);

    return this.withLlmFallback(
      () => this.llmImplement(fc, ctx, language, framework),
      () => this.offlineImplement(fc, language, framework),
    );
  }

  // ── LLM Implementation ─────────────────────────────────────────────────

  private async llmImplement(
    fc: FeatureContext,
    _ctx: SessionContext,
    language: string,
    framework: string,
  ): Promise<ImplementationOutput> {
    // LLM integration placeholder — will load prompt template and
    // send context to the configured AI provider when available.
    // For now, delegate to offline scaffold generation.
    return this.offlineImplement(fc, language, framework);
  }

  // ── Offline Scaffold Generation ────────────────────────────────────────

  private async offlineImplement(
    fc: FeatureContext,
    language: string,
    framework: string,
  ): Promise<ImplementationOutput> {
    const newComponents = this.extractNewComponents(fc);
    const extendComponents = this.extractExtendComponents(fc);
    const conventions = this.detectConventions(fc);
    const files: ImplementationFile[] = [];

    for (const comp of newComponents) {
      const generated = this.generateComponentFiles(comp, language, framework, conventions, fc);
      files.push(...generated);
    }

    // Generate extension guides for components being extended (not new)
    for (const comp of extendComponents) {
      files.push(this.generateExtensionGuide(comp, language, fc));
    }

    // Generate setup README (includes reuse context)
    files.push(this.generateReadme(fc, language, framework, newComponents));

    const totalLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);

    return {
      language,
      framework,
      files,
      setupInstructions: this.buildSetupInstructions(language, framework),
      testCommands: this.buildTestCommands(language, framework),
      totalFiles: files.length,
      totalLines,
    };
  }

  // ── Component File Generation ──────────────────────────────────────────

  private generateComponentFiles(
    comp: ProposedComponent,
    language: string,
    framework: string,
    conventions: ConventionInfo,
    fc: FeatureContext,
  ): ImplementationFile[] {
    const lowerLang = language.toLowerCase();
    const lowerFw = framework.toLowerCase();

    if (lowerFw.includes('angular') || lowerLang.includes('angular')) {
      return this.generateAngularFiles(comp, conventions);
    }
    if (lowerLang.includes('c#') || lowerFw.includes('.net') || lowerFw.includes('asp.net')) {
      return this.generateCSharpFiles(comp, conventions);
    }
    if (lowerLang.includes('python') || lowerFw.includes('django') || lowerFw.includes('fastapi') || lowerFw.includes('flask')) {
      return this.generatePythonFiles(comp, conventions, framework);
    }
    if (lowerLang.includes('sql') || comp.type === 'migration') {
      return this.generateSqlFiles(comp, fc);
    }
    if (lowerLang.includes('dart') || lowerFw.includes('flutter')) {
      return this.generateFlutterFiles(comp, conventions);
    }
    if (lowerLang.includes('foxpro') || lowerLang.includes('prg')) {
      return this.generateVfpFiles(comp);
    }
    if (['html', 'css', 'javascript', 'scss'].some((l) => lowerLang.includes(l))) {
      return this.generateWebFiles(comp);
    }

    return this.generateGenericFiles(comp, language, conventions);
  }

  // ── Angular ────────────────────────────────────────────────────────────

  private generateAngularFiles(comp: ProposedComponent, conv: ConventionInfo): ImplementationFile[] {
    const name = this.toKebab(comp.name);
    const className = this.toPascal(comp.name);
    const files: ImplementationFile[] = [];

    if (comp.type === 'service') {
      files.push({
        path: `${name}/${name}.service.ts`,
        content: [
          `import { Injectable, inject } from '@angular/core';`,
          `import { HttpClient } from '@angular/common/http';`,
          `import { Observable } from 'rxjs';`,
          '',
          `@Injectable({ providedIn: 'root' })`,
          `export class ${className}Service {`,
          `  private readonly http = inject(HttpClient);`,
          `  private readonly apiUrl = '/api/${name}';`,
          '',
          `  getAll(): Observable<${className}[]> {`,
          `    return this.http.get<${className}[]>(this.apiUrl);`,
          `  }`,
          '',
          `  getById(id: string): Observable<${className}> {`,
          `    return this.http.get<${className}>(\`\${this.apiUrl}/\${id}\`);`,
          `  }`,
          '',
          `  create(data: Create${className}Dto): Observable<${className}> {`,
          `    return this.http.post<${className}>(this.apiUrl, data);`,
          `  }`,
          '',
          `  update(id: string, data: Update${className}Dto): Observable<${className}> {`,
          `    return this.http.put<${className}>(\`\${this.apiUrl}/\${id}\`, data);`,
          `  }`,
          '',
          `  delete(id: string): Observable<void> {`,
          `    return this.http.delete<void>(\`\${this.apiUrl}/\${id}\`);`,
          `  }`,
          `}`,
          '',
          `export interface ${className} {`,
          `  id: string;`,
          `  // TODO: add entity fields based on requirements`,
          `}`,
          '',
          `export interface Create${className}Dto {`,
          `  // TODO: add creation fields`,
          `}`,
          '',
          `export interface Update${className}Dto extends Partial<Create${className}Dto> {}`,
        ].join('\n'),
        type: 'source',
        language: 'typescript',
        description: comp.description,
      });
      files.push({
        path: `${name}/${name}.service.spec.ts`,
        content: [
          `import { TestBed } from '@angular/core/testing';`,
          `import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';`,
          `import { ${className}Service } from './${name}.service';`,
          '',
          `describe('${className}Service', () => {`,
          `  let service: ${className}Service;`,
          `  let httpMock: HttpTestingController;`,
          '',
          `  beforeEach(() => {`,
          `    TestBed.configureTestingModule({`,
          `      imports: [HttpClientTestingModule],`,
          `    });`,
          `    service = TestBed.inject(${className}Service);`,
          `    httpMock = TestBed.inject(HttpTestingController);`,
          `  });`,
          '',
          `  afterEach(() => httpMock.verify());`,
          '',
          `  it('should be created', () => {`,
          `    expect(service).toBeTruthy();`,
          `  });`,
          '',
          `  it('should fetch all items', () => {`,
          `    service.getAll().subscribe((items) => {`,
          `      expect(items.length).toBeGreaterThan(0);`,
          `    });`,
          `    const req = httpMock.expectOne('/api/${name}');`,
          `    expect(req.request.method).toBe('GET');`,
          `    req.flush([{ id: '1' }]);`,
          `  });`,
          `});`,
        ].join('\n'),
        type: 'test',
        language: 'typescript',
        description: `Unit tests for ${className}Service`,
      });
    } else if (comp.type === 'controller') {
      files.push({
        path: `${name}/${name}.component.ts`,
        content: [
          `import { Component, inject, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';`,
          `import { CommonModule } from '@angular/common';`,
          `import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';`,
          `import { ${className}Service, ${className} } from './${name}.service';`,
          '',
          `@Component({`,
          `  selector: 'app-${name}',`,
          `  standalone: true,`,
          `  imports: [CommonModule, ReactiveFormsModule],`,
          `  templateUrl: './${name}.component.html',`,
          `  changeDetection: ChangeDetectionStrategy.OnPush,`,
          `})`,
          `export class ${className}Component implements OnInit {`,
          `  private readonly service = inject(${className}Service);`,
          `  private readonly fb = inject(FormBuilder);`,
          '',
          `  readonly items = signal<${className}[]>([]);`,
          `  readonly loading = signal(false);`,
          '',
          `  readonly form = this.fb.nonNullable.group({`,
          `    // TODO: add form fields based on requirements`,
          `  });`,
          '',
          `  ngOnInit(): void {`,
          `    this.loadItems();`,
          `  }`,
          '',
          `  private loadItems(): void {`,
          `    this.loading.set(true);`,
          `    this.service.getAll().subscribe({`,
          `      next: (data) => { this.items.set(data); this.loading.set(false); },`,
          `      error: () => this.loading.set(false),`,
          `    });`,
          `  }`,
          '',
          `  onSubmit(): void {`,
          `    if (this.form.invalid) return;`,
          `    this.service.create(this.form.getRawValue()).subscribe({`,
          `      next: () => { this.form.reset(); this.loadItems(); },`,
          `    });`,
          `  }`,
          `}`,
        ].join('\n'),
        type: 'source',
        language: 'typescript',
        description: comp.description,
      });
    }

    return files;
  }

  // ── C#/.NET ────────────────────────────────────────────────────────────

  private generateCSharpFiles(comp: ProposedComponent, conv: ConventionInfo): ImplementationFile[] {
    const className = this.toPascal(comp.name);
    const files: ImplementationFile[] = [];

    if (comp.type === 'service') {
      files.push({
        path: `Application/Services/${className}Service.cs`,
        content: [
          `using System.Collections.Generic;`,
          `using System.Threading;`,
          `using System.Threading.Tasks;`,
          '',
          `namespace Application.Services;`,
          '',
          `public interface I${className}Service`,
          `{`,
          `    Task<IEnumerable<${className}Dto>> GetAllAsync(CancellationToken ct = default);`,
          `    Task<${className}Dto?> GetByIdAsync(Guid id, CancellationToken ct = default);`,
          `    Task<${className}Dto> CreateAsync(Create${className}Dto dto, CancellationToken ct = default);`,
          `    Task<${className}Dto> UpdateAsync(Guid id, Update${className}Dto dto, CancellationToken ct = default);`,
          `    Task DeleteAsync(Guid id, CancellationToken ct = default);`,
          `}`,
          '',
          `public class ${className}Service : I${className}Service`,
          `{`,
          `    private readonly I${className}Repository _repository;`,
          '',
          `    public ${className}Service(I${className}Repository repository)`,
          `    {`,
          `        _repository = repository;`,
          `    }`,
          '',
          `    public async Task<IEnumerable<${className}Dto>> GetAllAsync(CancellationToken ct = default)`,
          `    {`,
          `        var entities = await _repository.GetAllAsync(ct);`,
          `        return entities.Select(e => MapToDto(e));`,
          `    }`,
          '',
          `    public async Task<${className}Dto?> GetByIdAsync(Guid id, CancellationToken ct = default)`,
          `    {`,
          `        var entity = await _repository.GetByIdAsync(id, ct);`,
          `        return entity is null ? null : MapToDto(entity);`,
          `    }`,
          '',
          `    public async Task<${className}Dto> CreateAsync(Create${className}Dto dto, CancellationToken ct = default)`,
          `    {`,
          `        var entity = new ${className}Entity`,
          `        {`,
          `            Id = Guid.NewGuid(),`,
          `            CreatedAt = DateTime.UtcNow,`,
          `            UpdatedAt = DateTime.UtcNow,`,
          `            // TODO: map fields from dto`,
          `        };`,
          `        await _repository.AddAsync(entity, ct);`,
          `        return MapToDto(entity);`,
          `    }`,
          '',
          `    public async Task<${className}Dto> UpdateAsync(Guid id, Update${className}Dto dto, CancellationToken ct = default)`,
          `    {`,
          `        var entity = await _repository.GetByIdAsync(id, ct)`,
          `            ?? throw new KeyNotFoundException($"${className} {id} not found");`,
          `        entity.UpdatedAt = DateTime.UtcNow;`,
          `        // TODO: map fields from dto`,
          `        await _repository.UpdateAsync(entity, ct);`,
          `        return MapToDto(entity);`,
          `    }`,
          '',
          `    public async Task DeleteAsync(Guid id, CancellationToken ct = default)`,
          `    {`,
          `        await _repository.DeleteAsync(id, ct);`,
          `    }`,
          '',
          `    private static ${className}Dto MapToDto(${className}Entity e) => new(e.Id, e.CreatedAt);`,
          `}`,
        ].join('\n'),
        type: 'source',
        language: 'csharp',
        description: comp.description,
      });
      files.push({
        path: `Domain/Entities/${className}Entity.cs`,
        content: [
          `namespace Domain.Entities;`,
          '',
          `public class ${className}Entity`,
          `{`,
          `    public Guid Id { get; set; }`,
          `    public DateTime CreatedAt { get; set; }`,
          `    public DateTime UpdatedAt { get; set; }`,
          `    // TODO: add domain properties`,
          `}`,
        ].join('\n'),
        type: 'model',
        language: 'csharp',
        description: `Domain entity for ${className}`,
      });
      files.push({
        path: `Application/DTOs/${className}Dto.cs`,
        content: [
          `namespace Application.DTOs;`,
          '',
          `public record ${className}Dto(Guid Id, DateTime CreatedAt);`,
          '',
          `public record Create${className}Dto();`,
          '',
          `public record Update${className}Dto();`,
        ].join('\n'),
        type: 'dto',
        language: 'csharp',
        description: `DTOs for ${className}`,
      });
      files.push({
        path: `Tests/${className}ServiceTests.cs`,
        content: [
          `using Xunit;`,
          `using Moq;`,
          `using FluentAssertions;`,
          '',
          `namespace Tests;`,
          '',
          `public class ${className}ServiceTests`,
          `{`,
          `    private readonly Mock<I${className}Repository> _repoMock = new();`,
          `    private readonly ${className}Service _sut;`,
          '',
          `    public ${className}ServiceTests()`,
          `    {`,
          `        _sut = new ${className}Service(_repoMock.Object);`,
          `    }`,
          '',
          `    [Fact]`,
          `    public async Task GetAllAsync_ShouldReturnItems()`,
          `    {`,
          `        // Arrange`,
          `        _repoMock.Setup(r => r.GetAllAsync(default))`,
          `            .ReturnsAsync(new[] { new ${className}Entity { Id = Guid.NewGuid(), CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow } });`,
          '',
          `        // Act`,
          `        var result = await _sut.GetAllAsync();`,
          '',
          `        // Assert`,
          `        result.Should().HaveCount(1);`,
          `    }`,
          `}`,
        ].join('\n'),
        type: 'test',
        language: 'csharp',
        description: `Unit tests for ${className}Service`,
      });
    } else if (comp.type === 'controller') {
      files.push({
        path: `Presentation/Controllers/${className}Controller.cs`,
        content: [
          `using Microsoft.AspNetCore.Mvc;`,
          `using Microsoft.AspNetCore.Authorization;`,
          '',
          `namespace Presentation.Controllers;`,
          '',
          `[ApiController]`,
          `[Route("api/[controller]")]`,
          `[Authorize]`,
          `public class ${className}Controller : ControllerBase`,
          `{`,
          `    private readonly I${className}Service _service;`,
          '',
          `    public ${className}Controller(I${className}Service service)`,
          `    {`,
          `        _service = service;`,
          `    }`,
          '',
          `    [HttpGet]`,
          `    public async Task<IActionResult> GetAll(CancellationToken ct)`,
          `        => Ok(await _service.GetAllAsync(ct));`,
          '',
          `    [HttpGet("{id:guid}")]`,
          `    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)`,
          `    {`,
          `        var result = await _service.GetByIdAsync(id, ct);`,
          `        return result is null ? NotFound() : Ok(result);`,
          `    }`,
          '',
          `    [HttpPost]`,
          `    public async Task<IActionResult> Create([FromBody] Create${className}Dto dto, CancellationToken ct)`,
          `    {`,
          `        var result = await _service.CreateAsync(dto, ct);`,
          `        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);`,
          `    }`,
          '',
          `    [HttpPut("{id:guid}")]`,
          `    public async Task<IActionResult> Update(Guid id, [FromBody] Update${className}Dto dto, CancellationToken ct)`,
          `        => Ok(await _service.UpdateAsync(id, dto, ct));`,
          '',
          `    [HttpDelete("{id:guid}")]`,
          `    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)`,
          `    {`,
          `        await _service.DeleteAsync(id, ct);`,
          `        return NoContent();`,
          `    }`,
          `}`,
        ].join('\n'),
        type: 'source',
        language: 'csharp',
        description: comp.description,
      });
    } else if (comp.type === 'repository') {
      files.push({
        path: `Infrastructure/Persistence/${className}Repository.cs`,
        content: [
          `using Microsoft.EntityFrameworkCore;`,
          '',
          `namespace Infrastructure.Persistence;`,
          '',
          `public interface I${className}Repository`,
          `{`,
          `    Task<IEnumerable<${className}Entity>> GetAllAsync(CancellationToken ct = default);`,
          `    Task<${className}Entity?> GetByIdAsync(Guid id, CancellationToken ct = default);`,
          `    Task AddAsync(${className}Entity entity, CancellationToken ct = default);`,
          `    Task UpdateAsync(${className}Entity entity, CancellationToken ct = default);`,
          `    Task DeleteAsync(Guid id, CancellationToken ct = default);`,
          `}`,
          '',
          `public class ${className}Repository : I${className}Repository`,
          `{`,
          `    private readonly AppDbContext _context;`,
          '',
          `    public ${className}Repository(AppDbContext context) => _context = context;`,
          '',
          `    public async Task<IEnumerable<${className}Entity>> GetAllAsync(CancellationToken ct = default)`,
          `        => await _context.Set<${className}Entity>().ToListAsync(ct);`,
          '',
          `    public async Task<${className}Entity?> GetByIdAsync(Guid id, CancellationToken ct = default)`,
          `        => await _context.Set<${className}Entity>().FindAsync(new object[] { id }, ct);`,
          '',
          `    public async Task AddAsync(${className}Entity entity, CancellationToken ct = default)`,
          `    {`,
          `        await _context.Set<${className}Entity>().AddAsync(entity, ct);`,
          `        await _context.SaveChangesAsync(ct);`,
          `    }`,
          '',
          `    public async Task UpdateAsync(${className}Entity entity, CancellationToken ct = default)`,
          `    {`,
          `        _context.Set<${className}Entity>().Update(entity);`,
          `        await _context.SaveChangesAsync(ct);`,
          `    }`,
          '',
          `    public async Task DeleteAsync(Guid id, CancellationToken ct = default)`,
          `    {`,
          `        var entity = await GetByIdAsync(id, ct);`,
          `        if (entity is not null)`,
          `        {`,
          `            _context.Set<${className}Entity>().Remove(entity);`,
          `            await _context.SaveChangesAsync(ct);`,
          `        }`,
          `    }`,
          `}`,
        ].join('\n'),
        type: 'source',
        language: 'csharp',
        description: comp.description,
      });
    }

    return files;
  }

  // ── Python ─────────────────────────────────────────────────────────────

  private generatePythonFiles(comp: ProposedComponent, conv: ConventionInfo, framework: string): ImplementationFile[] {
    const name = this.toSnake(comp.name);
    const className = this.toPascal(comp.name);
    const isFastApi = framework.toLowerCase().includes('fastapi');
    const files: ImplementationFile[] = [];

    if (comp.type === 'service') {
      files.push({
        path: `${name}/service.py`,
        content: [
          `from typing import List, Optional`,
          `from uuid import UUID`,
          ``,
          `from .repository import ${className}Repository`,
          `from .schemas import ${className}Response, Create${className}Request, Update${className}Request`,
          ``,
          ``,
          `class ${className}Service:`,
          `    """Business logic for ${className}."""`,
          ``,
          `    def __init__(self, repository: ${className}Repository) -> None:`,
          `        self._repository = repository`,
          ``,
          `    async def get_all(self) -> List[${className}Response]:`,
          `        entities = await self._repository.get_all()`,
          `        return [${className}Response.model_validate(e) for e in entities]`,
          ``,
          `    async def get_by_id(self, id: UUID) -> Optional[${className}Response]:`,
          `        entity = await self._repository.get_by_id(id)`,
          `        return ${className}Response.model_validate(entity) if entity else None`,
          ``,
          `    async def create(self, data: Create${className}Request) -> ${className}Response:`,
          `        entity = await self._repository.create(data.model_dump())`,
          `        return ${className}Response.model_validate(entity)`,
          ``,
          `    async def update(self, id: UUID, data: Update${className}Request) -> Optional[${className}Response]:`,
          `        entity = await self._repository.update(id, data.model_dump(exclude_unset=True))`,
          `        return ${className}Response.model_validate(entity) if entity else None`,
          ``,
          `    async def delete(self, id: UUID) -> bool:`,
          `        return await self._repository.delete(id)`,
        ].join('\n'),
        type: 'source',
        language: 'python',
        description: comp.description,
      });
      files.push({
        path: `${name}/schemas.py`,
        content: [
          `from datetime import datetime`,
          `from typing import Optional`,
          `from uuid import UUID`,
          ``,
          `from pydantic import BaseModel, ConfigDict`,
          ``,
          ``,
          `class Create${className}Request(BaseModel):`,
          `    """Input schema for creating a ${className}."""`,
          `    # TODO: add fields based on requirements`,
          `    pass`,
          ``,
          ``,
          `class Update${className}Request(BaseModel):`,
          `    """Input schema for updating a ${className}."""`,
          `    # TODO: add optional fields`,
          `    pass`,
          ``,
          ``,
          `class ${className}Response(BaseModel):`,
          `    """Output schema for ${className}."""`,
          `    model_config = ConfigDict(from_attributes=True)`,
          ``,
          `    id: UUID`,
          `    created_at: datetime`,
          `    updated_at: datetime`,
        ].join('\n'),
        type: 'dto',
        language: 'python',
        description: `Pydantic schemas for ${className}`,
      });
      files.push({
        path: `${name}/tests/test_service.py`,
        content: [
          `import pytest`,
          `from unittest.mock import AsyncMock`,
          `from uuid import uuid4`,
          ``,
          `from ${name}.service import ${className}Service`,
          ``,
          ``,
          `@pytest.fixture`,
          `def repo_mock():`,
          `    return AsyncMock()`,
          ``,
          ``,
          `@pytest.fixture`,
          `def service(repo_mock):`,
          `    return ${className}Service(repository=repo_mock)`,
          ``,
          ``,
          `@pytest.mark.asyncio`,
          `async def test_get_all_returns_list(service, repo_mock):`,
          `    repo_mock.get_all.return_value = []`,
          `    result = await service.get_all()`,
          `    assert isinstance(result, list)`,
          `    repo_mock.get_all.assert_awaited_once()`,
        ].join('\n'),
        type: 'test',
        language: 'python',
        description: `Tests for ${className}Service`,
      });
    }

    if (comp.type === 'controller' || (comp.type === 'service' && isFastApi)) {
      files.push({
        path: `${name}/router.py`,
        content: [
          `from typing import List`,
          `from uuid import UUID`,
          ``,
          `from fastapi import APIRouter, Depends, HTTPException, status`,
          ``,
          `from .dependencies import get_${name}_service`,
          `from .schemas import ${className}Response, Create${className}Request, Update${className}Request`,
          `from .service import ${className}Service`,
          ``,
          `router = APIRouter(prefix="/${name}s", tags=["${className}"])`,
          ``,
          ``,
          `@router.get("/", response_model=List[${className}Response])`,
          `async def list_items(service: ${className}Service = Depends(get_${name}_service)):`,
          `    return await service.get_all()`,
          ``,
          ``,
          `@router.get("/{item_id}", response_model=${className}Response)`,
          `async def get_item(item_id: UUID, service: ${className}Service = Depends(get_${name}_service)):`,
          `    result = await service.get_by_id(item_id)`,
          `    if not result:`,
          `        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="${className} not found")`,
          `    return result`,
          ``,
          ``,
          `@router.post("/", response_model=${className}Response, status_code=status.HTTP_201_CREATED)`,
          `async def create_item(data: Create${className}Request, service: ${className}Service = Depends(get_${name}_service)):`,
          `    return await service.create(data)`,
          ``,
          ``,
          `@router.put("/{item_id}", response_model=${className}Response)`,
          `async def update_item(item_id: UUID, data: Update${className}Request, service: ${className}Service = Depends(get_${name}_service)):`,
          `    result = await service.update(item_id, data)`,
          `    if not result:`,
          `        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="${className} not found")`,
          `    return result`,
          ``,
          ``,
          `@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)`,
          `async def delete_item(item_id: UUID, service: ${className}Service = Depends(get_${name}_service)):`,
          `    if not await service.delete(item_id):`,
          `        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="${className} not found")`,
        ].join('\n'),
        type: 'source',
        language: 'python',
        description: `FastAPI router for ${className}`,
      });
    }

    return files;
  }

  // ── SQL ────────────────────────────────────────────────────────────────

  private generateSqlFiles(comp: ProposedComponent, fc: FeatureContext): ImplementationFile[] {
    const tableName = this.toSnake(comp.name);
    const files: ImplementationFile[] = [];

    files.push({
      path: `migrations/V001_create_${tableName}.sql`,
      content: [
        `-- Migration: Create ${tableName} table`,
        `-- Generated by AI Developer Analytics`,
        ``,
        `BEGIN TRANSACTION;`,
        ``,
        `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${tableName}')`,
        `BEGIN`,
        `    CREATE TABLE ${tableName} (`,
        `        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,`,
        `        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),`,
        `        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),`,
        `        -- TODO: add columns based on requirements`,
        `    );`,
        ``,
        `    CREATE INDEX IX_${tableName}_created_at ON ${tableName}(created_at);`,
        `END;`,
        ``,
        `COMMIT TRANSACTION;`,
      ].join('\n'),
      type: 'migration',
      language: 'sql',
      description: `Create table migration for ${tableName}`,
    });
    files.push({
      path: `migrations/rollback/V001_rollback_${tableName}.sql`,
      content: [
        `-- Rollback: Drop ${tableName} table`,
        ``,
        `IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${tableName}')`,
        `BEGIN`,
        `    DROP TABLE ${tableName};`,
        `END;`,
      ].join('\n'),
      type: 'migration',
      language: 'sql',
      description: `Rollback migration for ${tableName}`,
    });

    return files;
  }

  // ── Flutter/Dart ───────────────────────────────────────────────────────

  private generateFlutterFiles(comp: ProposedComponent, conv: ConventionInfo): ImplementationFile[] {
    const name = this.toSnake(comp.name);
    const className = this.toPascal(comp.name);
    const files: ImplementationFile[] = [];

    if (comp.type === 'service' || comp.type === 'repository') {
      files.push({
        path: `lib/features/${name}/domain/repositories/${name}_repository.dart`,
        content: [
          `import 'package:dartz/dartz.dart';`,
          `import '../entities/${name}_entity.dart';`,
          ``,
          `abstract class ${className}Repository {`,
          `  Future<Either<Failure, List<${className}Entity>>> getAll();`,
          `  Future<Either<Failure, ${className}Entity>> getById(String id);`,
          `  Future<Either<Failure, ${className}Entity>> create(${className}Entity entity);`,
          `  Future<Either<Failure, ${className}Entity>> update(${className}Entity entity);`,
          `  Future<Either<Failure, void>> delete(String id);`,
          `}`,
          ``,
          `class Failure {`,
          `  final String message;`,
          `  const Failure(this.message);`,
          `}`,
        ].join('\n'),
        type: 'interface',
        language: 'dart',
        description: `Repository contract for ${className}`,
      });
      files.push({
        path: `lib/features/${name}/domain/entities/${name}_entity.dart`,
        content: [
          `class ${className}Entity {`,
          `  final String id;`,
          `  final DateTime createdAt;`,
          `  final DateTime updatedAt;`,
          `  // TODO: add entity fields`,
          ``,
          `  const ${className}Entity({`,
          `    required this.id,`,
          `    required this.createdAt,`,
          `    required this.updatedAt,`,
          `  });`,
          `}`,
        ].join('\n'),
        type: 'model',
        language: 'dart',
        description: `Domain entity for ${className}`,
      });
      files.push({
        path: `lib/features/${name}/presentation/bloc/${name}_bloc.dart`,
        content: [
          `import 'package:flutter_bloc/flutter_bloc.dart';`,
          `import '../../domain/repositories/${name}_repository.dart';`,
          ``,
          `// Events`,
          `abstract class ${className}Event {}`,
          `class Load${className}s extends ${className}Event {}`,
          ``,
          `// States`,
          `abstract class ${className}State {}`,
          `class ${className}Initial extends ${className}State {}`,
          `class ${className}Loading extends ${className}State {}`,
          `class ${className}Loaded extends ${className}State {`,
          `  final List items;`,
          `  ${className}Loaded(this.items);`,
          `}`,
          `class ${className}Error extends ${className}State {`,
          `  final String message;`,
          `  ${className}Error(this.message);`,
          `}`,
          ``,
          `class ${className}Bloc extends Bloc<${className}Event, ${className}State> {`,
          `  final ${className}Repository repository;`,
          ``,
          `  ${className}Bloc({required this.repository}) : super(${className}Initial()) {`,
          `    on<Load${className}s>(_onLoad);`,
          `  }`,
          ``,
          `  Future<void> _onLoad(Load${className}s event, Emitter<${className}State> emit) async {`,
          `    emit(${className}Loading());`,
          `    final result = await repository.getAll();`,
          `    result.fold(`,
          `      (failure) => emit(${className}Error(failure.message)),`,
          `      (items) => emit(${className}Loaded(items)),`,
          `    );`,
          `  }`,
          `}`,
        ].join('\n'),
        type: 'source',
        language: 'dart',
        description: `BLoC state management for ${className}`,
      });
      files.push({
        path: `test/features/${name}/${name}_bloc_test.dart`,
        content: [
          `import 'package:flutter_test/flutter_test.dart';`,
          `import 'package:bloc_test/bloc_test.dart';`,
          `import 'package:mockito/mockito.dart';`,
          `import 'package:dartz/dartz.dart';`,
          ``,
          `// TODO: generate mocks with build_runner`,
          ``,
          `void main() {`,
          `  group('${className}Bloc', () {`,
          `    blocTest<dynamic, dynamic>(`,
          `      'emits [Loading, Loaded] when Load${className}s is added',`,
          `      build: () {`,
          `        // TODO: setup mock repository`,
          `        throw UnimplementedError();`,
          `      },`,
          `      act: (bloc) => bloc.add(Load${className}s()),`,
          `      expect: () => [isA<${className}Loading>(), isA<${className}Loaded>()],`,
          `    );`,
          `  });`,
          `}`,
        ].join('\n'),
        type: 'test',
        language: 'dart',
        description: `BLoC tests for ${className}`,
      });
    }

    return files;
  }

  // ── Visual FoxPro ──────────────────────────────────────────────────────

  private generateVfpFiles(comp: ProposedComponent): ImplementationFile[] {
    const name = this.toSnake(comp.name);
    const className = this.toPascal(comp.name);
    const files: ImplementationFile[] = [];

    // Business Logic Layer (.prg)
    files.push({
      path: `${name}/${name}_bll.prg`,
      content: [
        `*-- Business Logic Layer: ${className}`,
        `*-- Generated by AI Developer Analytics`,
        `*-- Lógica de negócio — não contém acesso direto a dados`,
        ``,
        `DEFINE CLASS ${className}BLL AS Custom`,
        `  cErrorMessage = ""`,
        `  oDAL = .NULL.`,
        ``,
        `  PROCEDURE Init`,
        `    THIS.oDAL = CREATEOBJECT("${className}DAL")`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE GetAll`,
        `    LOCAL lnResult`,
        `    TRY`,
        `      lnResult = THIS.oDAL.GetAll()`,
        `    CATCH TO loEx`,
        `      THIS.cErrorMessage = loEx.Message`,
        `      lnResult = -1`,
        `    ENDTRY`,
        `    RETURN lnResult`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE GetById(tnId AS Integer)`,
        `    LOCAL lnResult`,
        `    IF EMPTY(tnId) OR tnId <= 0`,
        `      THIS.cErrorMessage = "ID inválido"`,
        `      RETURN -1`,
        `    ENDIF`,
        `    TRY`,
        `      lnResult = THIS.oDAL.GetById(tnId)`,
        `    CATCH TO loEx`,
        `      THIS.cErrorMessage = loEx.Message`,
        `      lnResult = -1`,
        `    ENDTRY`,
        `    RETURN lnResult`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Create(tcData AS String)`,
        `    LOCAL lnResult`,
        `    IF EMPTY(tcData)`,
        `      THIS.cErrorMessage = "Dados inválidos"`,
        `      RETURN -1`,
        `    ENDIF`,
        `    TRY`,
        `      lnResult = THIS.oDAL.Insert(tcData)`,
        `    CATCH TO loEx`,
        `      THIS.cErrorMessage = loEx.Message`,
        `      lnResult = -1`,
        `    ENDTRY`,
        `    RETURN lnResult`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Update(tnId AS Integer, tcData AS String)`,
        `    LOCAL lnResult`,
        `    IF EMPTY(tnId) OR EMPTY(tcData)`,
        `      THIS.cErrorMessage = "Parâmetros inválidos"`,
        `      RETURN -1`,
        `    ENDIF`,
        `    TRY`,
        `      lnResult = THIS.oDAL.Update(tnId, tcData)`,
        `    CATCH TO loEx`,
        `      THIS.cErrorMessage = loEx.Message`,
        `      lnResult = -1`,
        `    ENDTRY`,
        `    RETURN lnResult`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Delete(tnId AS Integer)`,
        `    LOCAL lnResult`,
        `    IF EMPTY(tnId) OR tnId <= 0`,
        `      THIS.cErrorMessage = "ID inválido"`,
        `      RETURN -1`,
        `    ENDIF`,
        `    TRY`,
        `      lnResult = THIS.oDAL.Delete(tnId)`,
        `    CATCH TO loEx`,
        `      THIS.cErrorMessage = loEx.Message`,
        `      lnResult = -1`,
        `    ENDTRY`,
        `    RETURN lnResult`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Validate(toRecord AS Object)`,
        `    *-- Override para validações específicas`,
        `    RETURN .T.`,
        `  ENDPROC`,
        ``,
        `ENDDEFINE`,
      ].join('\n'),
      type: 'source',
      language: 'foxpro',
      description: comp.description,
    });

    // Data Access Layer (.prg) — SQL Pass-through
    files.push({
      path: `${name}/${name}_dal.prg`,
      content: [
        `*-- Data Access Layer: ${className}`,
        `*-- Uses SQL pass-through for SQL Server`,
        `*-- Parameterized queries for security`,
        ``,
        `DEFINE CLASS ${className}DAL AS Custom`,
        `  nHandle = 0`,
        ``,
        `  PROCEDURE Init`,
        `    THIS.nHandle = SQLSTRINGCONNECT(GetConnectionString())`,
        `    IF THIS.nHandle <= 0`,
        `      ERROR "Falha na conexão com o banco de dados"`,
        `    ENDIF`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE GetAll`,
        `    LOCAL lnResult`,
        `    lnResult = SQLEXEC(THIS.nHandle, "SELECT * FROM ${name} ORDER BY id", "qResult")`,
        `    RETURN lnResult`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE GetById(tnId AS Integer)`,
        `    LOCAL lnResult`,
        `    lnResult = SQLEXEC(THIS.nHandle, "SELECT * FROM ${name} WHERE id = ?tnId", "qResult")`,
        `    RETURN lnResult`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Insert(tcData AS String)`,
        `    LOCAL lnResult`,
        `    lnResult = SQLEXEC(THIS.nHandle, "INSERT INTO ${name} (data, created_at) VALUES (?tcData, GETUTCDATE())")`,
        `    RETURN lnResult`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Update(tnId AS Integer, tcData AS String)`,
        `    LOCAL lnResult`,
        `    lnResult = SQLEXEC(THIS.nHandle, "UPDATE ${name} SET data = ?tcData, updated_at = GETUTCDATE() WHERE id = ?tnId")`,
        `    RETURN lnResult`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Delete(tnId AS Integer)`,
        `    LOCAL lnResult`,
        `    lnResult = SQLEXEC(THIS.nHandle, "DELETE FROM ${name} WHERE id = ?tnId")`,
        `    RETURN lnResult`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Destroy`,
        `    IF THIS.nHandle > 0`,
        `      SQLDISCONNECT(THIS.nHandle)`,
        `    ENDIF`,
        `  ENDPROC`,
        ``,
        `ENDDEFINE`,
      ].join('\n'),
      type: 'source',
      language: 'foxpro',
      description: `Data access layer for ${className}`,
    });

    // Form XML — converted from .scx/.sct to .xml
    if (comp.type === 'service' || comp.type === 'controller' || comp.type === 'form') {
      files.push({
        path: `Forms/${name}_form.xml`,
        content: [
          `<?xml version="1.0" encoding="utf-8"?>`,
          `<!-- VFP Form: ${className} — Converted from .scx/.sct -->`,
          `<!-- Edit this XML directly for UI changes -->`,
          `<VFPData>`,
          `  <form name="frm${className}" class="frmBase" baseclass="form"`,
          `    caption="${className}" width="800" height="600">`,
          `    `,
          `    <!-- Toolbar de navegação CRUD -->`,
          `    <toolbar name="tlb${className}" top="0" left="0" width="800" height="40">`,
          `      <CommandButton name="btnFirst" caption="|&lt;" />`,
          `      <CommandButton name="btnPrev" caption="&lt;" />`,
          `      <CommandButton name="btnNext" caption="&gt;" />`,
          `      <CommandButton name="btnLast" caption="&gt;|" />`,
          `      <CommandButton name="btnNew" caption="Novo" />`,
          `      <CommandButton name="btnSave" caption="Salvar" />`,
          `      <CommandButton name="btnDelete" caption="Excluir" />`,
          `      <CommandButton name="btnCancel" caption="Cancelar" />`,
          `    </toolbar>`,
          `    `,
          `    <!-- Grid de listagem -->`,
          `    <Grid name="grd${className}" top="50" left="10" width="780" height="300"`,
          `      RecordSource="qResult" ReadOnly=".T." AllowHeaderSizing=".T.">`,
          `      <!-- Columns configured at runtime via Init -->`,
          `    </Grid>`,
          `    `,
          `    <!-- Área de edição -->`,
          `    <PageFrame name="pgf${className}" top="360" left="10" width="780" height="220">`,
          `      <Page name="pagDados" caption="Dados">`,
          `        <Label name="lblId" caption="ID:" top="10" left="10" />`,
          `        <TextBox name="txtId" top="10" left="80" width="100" ReadOnly=".T." />`,
          `        <!-- TODO: Add fields specific to ${className} -->`,
          `      </Page>`,
          `    </PageFrame>`,
          `    `,
          `  </form>`,
          `</VFPData>`,
        ].join('\n'),
        type: 'source',
        language: 'xml',
        description: `VFP form (converted .scx/.sct → .xml) for ${className}`,
      });
    }

    // Form code-behind (.prg) — binds to .xml form
    if (comp.type === 'service' || comp.type === 'controller' || comp.type === 'form') {
      files.push({
        path: `Forms/${name}_form.prg`,
        content: [
          `*-- Form Code-Behind: frm${className}`,
          `*-- Pairs with ${name}_form.xml (converted .scx/.sct)`,
          `*-- Contains event handlers and form logic`,
          ``,
          `DEFINE CLASS frm${className} AS frmBase`,
          `  oBLL = .NULL.`,
          ``,
          `  PROCEDURE Init`,
          `    THIS.oBLL = CREATEOBJECT("${className}BLL")`,
          `    THIS.RefreshGrid()`,
          `  ENDPROC`,
          ``,
          `  PROCEDURE RefreshGrid`,
          `    LOCAL lnResult`,
          `    lnResult = THIS.oBLL.GetAll()`,
          `    IF lnResult >= 0`,
          `      THIS.grd${className}.RecordSource = "qResult"`,
          `      THIS.grd${className}.Refresh()`,
          `    ELSE`,
          `      MESSAGEBOX(THIS.oBLL.cErrorMessage, 16, "Erro")`,
          `    ENDIF`,
          `  ENDPROC`,
          ``,
          `  PROCEDURE btnNew.Click`,
          `    THISFORM.SetMode("insert")`,
          `  ENDPROC`,
          ``,
          `  PROCEDURE btnSave.Click`,
          `    LOCAL lcData`,
          `    lcData = THISFORM.CollectFormData()`,
          `    IF THISFORM.oBLL.Create(lcData) >= 0`,
          `      THISFORM.RefreshGrid()`,
          `      MESSAGEBOX("Registro salvo com sucesso.", 64, "Sucesso")`,
          `    ELSE`,
          `      MESSAGEBOX(THISFORM.oBLL.cErrorMessage, 16, "Erro")`,
          `    ENDIF`,
          `  ENDPROC`,
          ``,
          `  PROCEDURE btnDelete.Click`,
          `    IF MESSAGEBOX("Confirma exclusão?", 4+32, "Confirmação") = 6`,
          `      LOCAL lnId`,
          `      lnId = VAL(THISFORM.txtId.Value)`,
          `      IF THISFORM.oBLL.Delete(lnId) >= 0`,
          `        THISFORM.RefreshGrid()`,
          `      ELSE`,
          `        MESSAGEBOX(THISFORM.oBLL.cErrorMessage, 16, "Erro")`,
          `      ENDIF`,
          `    ENDIF`,
          `  ENDPROC`,
          ``,
          `  PROCEDURE CollectFormData`,
          `    *-- Override to collect specific fields from form`,
          `    RETURN ""`,
          `  ENDPROC`,
          ``,
          `  PROCEDURE SetMode(tcMode AS String)`,
          `    *-- Toggle between browse/insert/edit modes`,
          `    DO CASE`,
          `    CASE tcMode = "browse"`,
          `      THISFORM.pgf${className}.pagDados.Enabled = .F.`,
          `    CASE tcMode = "insert" OR tcMode = "edit"`,
          `      THISFORM.pgf${className}.pagDados.Enabled = .T.`,
          `    ENDCASE`,
          `  ENDPROC`,
          ``,
          `ENDDEFINE`,
        ].join('\n'),
        type: 'source',
        language: 'foxpro',
        description: `Form code-behind for frm${className} (event handlers, data binding)`,
      });
    }

    // FoxUnit test (.prg)
    files.push({
      path: `Tests/test_${name}.prg`,
      content: [
        `*-- Unit Tests: ${className}`,
        `*-- FoxUnit test class`,
        ``,
        `DEFINE CLASS Test${className} AS FxuTestCase OF FxuTestCase.prg`,
        `  oBLL = .NULL.`,
        ``,
        `  PROCEDURE Setup`,
        `    THIS.oBLL = CREATEOBJECT("${className}BLL")`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE TearDown`,
        `    THIS.oBLL = .NULL.`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Test_Init_Creates_DAL`,
        `    THIS.AssertNotNull(THIS.oBLL.oDAL, "DAL should be created on Init")`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Test_Create_With_Empty_Data_Returns_Error`,
        `    LOCAL lnResult`,
        `    lnResult = THIS.oBLL.Create("")`,
        `    THIS.AssertEquals(-1, lnResult, "Empty data should return -1")`,
        `    THIS.AssertTrue(!EMPTY(THIS.oBLL.cErrorMessage), "Error message should be set")`,
        `  ENDPROC`,
        ``,
        `  PROCEDURE Test_GetById_Invalid_Id_Returns_Error`,
        `    LOCAL lnResult`,
        `    lnResult = THIS.oBLL.GetById(0)`,
        `    THIS.AssertEquals(-1, lnResult, "Invalid ID should return -1")`,
        `  ENDPROC`,
        ``,
        `ENDDEFINE`,
      ].join('\n'),
      type: 'test',
      language: 'foxpro',
      description: `FoxUnit tests for ${className}`,
    });

    return files;
  }

  // ── Web (HTML/CSS/JS) ──────────────────────────────────────────────────

  private generateWebFiles(comp: ProposedComponent): ImplementationFile[] {
    const name = this.toKebab(comp.name);
    const className = this.toPascal(comp.name);
    const files: ImplementationFile[] = [];

    if (comp.type === 'service' || comp.type === 'utility') {
      files.push({
        path: `js/${name}.js`,
        content: [
          `/**`,
          ` * ${className} — ${comp.description}`,
          ` */`,
          ``,
          `const API_BASE = '/api/${name}';`,
          ``,
          `export async function getAll() {`,
          `  const response = await fetch(API_BASE);`,
          `  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);`,
          `  return response.json();`,
          `}`,
          ``,
          `export async function getById(id) {`,
          `  const response = await fetch(\`\${API_BASE}/\${encodeURIComponent(id)}\`);`,
          `  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);`,
          `  return response.json();`,
          `}`,
          ``,
          `export async function create(data) {`,
          `  const response = await fetch(API_BASE, {`,
          `    method: 'POST',`,
          `    headers: { 'Content-Type': 'application/json' },`,
          `    body: JSON.stringify(data),`,
          `  });`,
          `  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);`,
          `  return response.json();`,
          `}`,
          ``,
          `export async function update(id, data) {`,
          `  const response = await fetch(\`\${API_BASE}/\${encodeURIComponent(id)}\`, {`,
          `    method: 'PUT',`,
          `    headers: { 'Content-Type': 'application/json' },`,
          `    body: JSON.stringify(data),`,
          `  });`,
          `  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);`,
          `  return response.json();`,
          `}`,
          ``,
          `export async function remove(id) {`,
          `  const response = await fetch(\`\${API_BASE}/\${encodeURIComponent(id)}\`, { method: 'DELETE' });`,
          `  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);`,
          `}`,
        ].join('\n'),
        type: 'source',
        language: 'javascript',
        description: comp.description,
      });
    }

    return files;
  }

  // ── Generic ────────────────────────────────────────────────────────────

  private generateGenericFiles(comp: ProposedComponent, language: string, conv: ConventionInfo): ImplementationFile[] {
    const name = conv.namingConvention === 'snake_case' ? this.toSnake(comp.name) : this.toKebab(comp.name);
    const className = this.toPascal(comp.name);
    const ext = LANGUAGE_EXT_MAP[language.toLowerCase()] ?? 'txt';
    const files: ImplementationFile[] = [];

    files.push({
      path: `${name}/${name}.${ext}`,
      content: [
        `// ${className} — ${comp.description}`,
        `// Type: ${comp.type}`,
        `// Dependencies: ${comp.dependencies.join(', ') || 'none'}`,
        `// Generated by AI Developer Analytics`,
        ``,
        `// TODO: Implement ${className} for ${language}`,
        `// Follow SOLID principles and existing codebase conventions.`,
      ].join('\n'),
      type: 'source',
      language: language.toLowerCase(),
      description: comp.description,
    });

    return files;
  }

  // ── README Generation ──────────────────────────────────────────────────

  private generateReadme(
    fc: FeatureContext,
    language: string,
    framework: string,
    components: ProposedComponent[],
  ): ImplementationFile {
    const extendComponents = this.extractExtendComponents(fc);

    const lines: string[] = [
      `# Implementation: ${fc.rawRequirements ?? 'Feature'}`,
      '',
      `> Generated by AI Developer Analytics`,
      '',
      `## Stack`,
      '',
      `- **Language**: ${language}`,
      `- **Framework**: ${framework}`,
      `- **New components**: ${components.length}`,
      `- **Extending existing**: ${extendComponents.length}`,
      '',
    ];

    // Reuse section — critical for developers to know what NOT to rewrite
    if (fc.reuseAnalysis && fc.reuseAnalysis.candidates.length > 0) {
      lines.push(`## Reuse (DO NOT reimplement)`, '');
      lines.push(`> Score: ${fc.reuseAnalysis.reuseScore}%`, '');
      for (const c of fc.reuseAnalysis.candidates.filter((r) => r.relevance === 'high' || r.relevance === 'medium')) {
        lines.push(`- **${c.name}** (${c.type}) — \`${c.filePath}\``);
        lines.push(`  ${c.reason}`);
      }
      lines.push('');
    }

    if (extendComponents.length > 0) {
      lines.push(`## Extensions (modify existing — don't create new)`, '');
      for (const comp of extendComponents) {
        lines.push(`### ${comp.name} (${comp.type})`);
        lines.push(`${comp.description}`);
        if (comp.dependencies.length > 0) {
          lines.push(`- Dependencies: ${comp.dependencies.join(', ')}`);
        }
        lines.push('');
      }
    }

    if (components.length > 0) {
      lines.push(`## New Components`, '');
      for (const comp of components) {
        lines.push(`### ${comp.name} (${comp.type})`);
        lines.push(`${comp.description}`);
        if (comp.dependencies.length > 0) {
          lines.push(`- Dependencies: ${comp.dependencies.join(', ')}`);
        }
        lines.push('');
      }
    }

    lines.push('## Setup', '');
    lines.push(this.buildSetupInstructions(language, framework));
    lines.push('');
    lines.push('## Tests', '');
    for (const cmd of this.buildTestCommands(language, framework)) {
      lines.push(`\`\`\`bash\n${cmd}\n\`\`\``);
    }

    return {
      path: 'README.md',
      content: lines.join('\n'),
      type: 'config',
      language: 'markdown',
      description: 'Setup and usage instructions',
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private detectPrimaryLanguage(fc: FeatureContext): { language: string; framework: string } {
    let language = 'TypeScript';
    let framework = 'Generic';

    if (fc.repositoryContext) {
      const langs = fc.repositoryContext.languages;
      if (langs.length > 0) {
        language = langs[0].language;
      }

      const fws = fc.repositoryContext.frameworks;
      if (fws.length > 0) {
        framework = fws[0].name;
      }
    }

    return { language, framework };
  }

  private extractNewComponents(fc: FeatureContext): ProposedComponent[] {
    if (!fc.solutionArchitecture) return [];
    return fc.solutionArchitecture.proposedComponents.filter((c) => c.isNew);
  }

  private extractExtendComponents(fc: FeatureContext): ProposedComponent[] {
    if (!fc.solutionArchitecture) return [];
    return fc.solutionArchitecture.proposedComponents.filter((c) => !c.isNew);
  }

  /**
   * Generate an extension guide file for an existing component being modified.
   * Instead of creating brand-new code, produces a file with clear instructions
   * on what to ADD to the existing component, preserving legacy methods.
   */
  private generateExtensionGuide(
    comp: ProposedComponent,
    language: string,
    fc: FeatureContext,
  ): ImplementationFile {
    const ext = LANGUAGE_EXT_MAP[language.toLowerCase()] ?? 'txt';
    const kebab = this.toKebab(comp.name);
    const pascal = this.toPascal(comp.name);
    const feature = fc.rawRequirements ?? 'feature';

    // Find existing methods to list as "preserve"
    const existingSvc = fc.repositoryContext?.services.find((s) => s.name === comp.name);
    const existingCtrl = fc.repositoryContext?.controllers?.find((c) => c.name === comp.name);
    const existingMethods = existingSvc?.methods ?? existingCtrl?.actions.map((a) => a.name) ?? [];

    // Find reuse candidate for additional context
    const reuseCandidate = fc.reuseAnalysis?.candidates.find(
      (c) => c.name.toLowerCase() === comp.name.toLowerCase(),
    );

    const lines: string[] = [
      `// ============================================================`,
      `// EXTENSION GUIDE: ${comp.name}`,
      `// Description: ${comp.description}`,
      `// Feature: ${feature}`,
      `// ============================================================`,
      `//`,
      `// This file describes what to ADD to the EXISTING component.`,
      `// DO NOT create a new file — modify the original at:`,
      `//   ${reuseCandidate?.filePath ?? existingSvc?.filePath ?? comp.name}`,
      `//`,
    ];

    if (existingMethods.length > 0) {
      lines.push(`// PRESERVE these existing methods (do not modify signatures):`);
      for (const m of existingMethods.slice(0, 15)) {
        lines.push(`//   - ${m}`);
      }
      if (existingMethods.length > 15) {
        lines.push(`//   ... and ${existingMethods.length - 15} more`);
      }
      lines.push(`//`);
    }

    if (comp.dependencies.length > 0) {
      lines.push(`// Dependencies (already injected or to inject):`);
      for (const d of comp.dependencies) {
        lines.push(`//   - ${d}`);
      }
      lines.push(`//`);
    }

    lines.push(
      `// ADD the following methods/functionality:`,
      `// ============================================================`,
      ``,
    );

    // Generate stub methods to add based on the feature
    const featureBase = this.toKebab(feature).replace(/-/g, '_').slice(0, 30);
    const lowerLang = language.toLowerCase();

    if (lowerLang.includes('c#') || lowerLang.includes('.net')) {
      lines.push(
        `// Add these methods to the existing ${pascal} class:`,
        ``,
        `public async Task<${pascal}Result> Process${this.toPascal(featureBase)}Async(${pascal}Request request)`,
        `{`,
        `    // TODO: Implement ${feature} logic`,
        `    // Reuse existing methods: ${existingMethods.slice(0, 3).join(', ') || 'N/A'}`,
        `    throw new NotImplementedException();`,
        `}`,
      );
    } else if (lowerLang.includes('python')) {
      lines.push(
        `# Add these methods to the existing ${pascal} class:`,
        ``,
        `def process_${featureBase}(self, request: dict) -> dict:`,
        `    """${feature}"""`,
        `    # TODO: Implement — reuse existing methods: ${existingMethods.slice(0, 3).join(', ') || 'N/A'}`,
        `    raise NotImplementedError()`,
      );
    } else if (lowerLang.includes('foxpro')) {
      lines.push(
        `*-- Add these methods to the existing ${pascal} class:`,
        ``,
        `PROCEDURE Process${this.toPascal(featureBase)}`,
        `  LPARAMETERS toRequest`,
        `  *-- TODO: Implement ${feature}`,
        `  *-- Reuse existing methods: ${existingMethods.slice(0, 3).join(', ') || 'N/A'}`,
        `  RETURN .F.`,
        `ENDPROC`,
      );
    } else {
      // TypeScript / JavaScript / Generic
      lines.push(
        `// Add these methods to the existing ${pascal} class:`,
        ``,
        `async process${this.toPascal(featureBase)}(request: unknown): Promise<unknown> {`,
        `  // TODO: Implement ${feature}`,
        `  // Reuse existing methods: ${existingMethods.slice(0, 3).join(', ') || 'N/A'}`,
        `  throw new Error('Not implemented');`,
        `}`,
      );
    }

    return {
      path: `extensions/${kebab}-extension.${ext}`,
      content: lines.join('\n'),
      type: 'source',
      language: ext,
      description: `Extension guide for existing ${comp.name} — add new methods without modifying existing ones`,
    };
  }

  private detectConventions(fc: FeatureContext): ConventionInfo {
    let namingConvention: 'camelCase' | 'PascalCase' | 'kebab-case' | 'snake_case' = 'camelCase';

    if (fc.repositoryContext) {
      const services = fc.repositoryContext.services;
      if (services.length > 0) {
        const names = services.map((s) => s.name);
        if (names.some((n) => n.includes('_'))) namingConvention = 'snake_case';
        else if (names.some((n) => n.includes('-'))) namingConvention = 'kebab-case';
        else if (names.some((n) => /^[A-Z]/.test(n))) namingConvention = 'PascalCase';
      }
    }

    return { namingConvention };
  }

  private buildSetupInstructions(language: string, framework: string): string {
    const lower = language.toLowerCase();
    const fwLower = framework.toLowerCase();

    if (fwLower.includes('angular')) return '1. Copy files into your Angular project\n2. Run `ng generate` if needed\n3. Register routes and imports';
    if (lower.includes('c#') || fwLower.includes('.net')) return '1. Add files to respective project layers\n2. Register services in DI container\n3. Run `dotnet ef migrations add` for DB changes\n4. Run `dotnet build` to verify';
    if (lower.includes('python')) return '1. Copy module into your project\n2. Install dependencies: `pip install -r requirements.txt`\n3. Run migrations: `alembic upgrade head`\n4. Register router in main app';
    if (lower.includes('dart') || fwLower.includes('flutter')) return '1. Copy files into lib/features/\n2. Run `dart run build_runner build` for code generation\n3. Register BLoC providers\n4. Run `flutter pub get`';
    if (lower.includes('sql')) return '1. Review migration scripts\n2. Execute in order: V001, V002...\n3. Verify rollback scripts work';
    if (lower.includes('foxpro')) return '1. Copy PRG files to project directory\n2. Copy XML form files to Forms/ directory\n3. SET PROCEDURE TO the new PRG files\n4. Verify SQL Server connection string\n5. Forms: edit .xml files for UI changes (converted from .scx/.sct)\n6. Run FoxUnit tests';

    return '1. Copy generated files into your project\n2. Install any missing dependencies\n3. Run tests to verify';
  }

  private buildTestCommands(language: string, framework: string): string[] {
    const lower = language.toLowerCase();
    const fwLower = framework.toLowerCase();

    if (fwLower.includes('angular')) return ['ng test --include=**/feature-name/**'];
    if (lower.includes('c#') || fwLower.includes('.net')) return ['dotnet test'];
    if (lower.includes('python')) return ['pytest -v'];
    if (lower.includes('dart') || fwLower.includes('flutter')) return ['flutter test'];
    if (lower.includes('javascript') || lower.includes('typescript')) return ['npm test'];

    return ['# Run your project test suite'];
  }

  /** Resolve the prompt template file path for a given language. */
  getPromptFile(language: string): string | undefined {
    const lowerLang = language.toLowerCase();
    for (const [key, file] of Object.entries(LANGUAGE_PROMPT_MAP)) {
      if (lowerLang.includes(key)) {
        return path.join(__dirname, '..', '..', 'prompts', file);
      }
    }
    return path.join(__dirname, '..', '..', 'prompts', 'implementation-generic-agent.txt');
  }

  // ── String Transformations ─────────────────────────────────────────────

  private toKebab(name: string): string {
    return name
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private toPascal(name: string): string {
    return name
      .replace(/[-_\s]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (c) => c.toUpperCase());
  }

  private toSnake(name: string): string {
    return name
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  }
}

interface ConventionInfo {
  namingConvention: 'camelCase' | 'PascalCase' | 'kebab-case' | 'snake_case';
}
