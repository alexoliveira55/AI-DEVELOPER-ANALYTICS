import * as fs from 'fs';
import * as path from 'path';
import { BaseAgent } from '../core';
import {
  AgentRole, FeatureContext, RichPrototypeOutput, SessionContext,
} from '../types';
import { RepositoryContext } from '../indexer';

/**
 * Generates a rich, responsive, interactive prototype tailored to the detected
 * framework (Angular, Flutter, HTML/CSS/JS, .NET, Python).
 */
export class RichPrototypeGeneratorAgent extends BaseAgent<FeatureContext, RichPrototypeOutput> {
  readonly role = AgentRole.RichPrototypeGenerator;
  readonly name = 'Rich Prototype Generator';

  protected async run(fc: FeatureContext, context: SessionContext): Promise<RichPrototypeOutput> {
    return this.withLlmFallback(
      () => this.llmGenerate(fc, context),
      () => this.offlineGenerate(fc, context),
    );
  }

  private async llmGenerate(_fc: FeatureContext, _ctx: SessionContext): Promise<RichPrototypeOutput> {
    return this.offlineGenerate(_fc, _ctx);
  }

  private async offlineGenerate(fc: FeatureContext, context: SessionContext): Promise<RichPrototypeOutput> {
    const repo = fc.repositoryContext;
    const framework = this.detectFramework(repo);
    const feature = fc.rawRequirements ?? 'funcionalidade';
    const moduleName = this.toModuleName(feature);

    let files: { path: string; content: string }[];
    let entryPoint: string;

    switch (framework) {
      case 'angular':
        files = this.generateAngularPrototype(moduleName, feature, fc);
        entryPoint = `${moduleName}/${moduleName}.component.ts`;
        break;
      case 'flutter':
        files = this.generateFlutterPrototype(moduleName, feature, fc);
        entryPoint = `lib/features/${moduleName}/${moduleName}_page.dart`;
        break;
      case 'dotnet':
        files = this.generateDotNetPrototype(moduleName, feature, fc);
        entryPoint = `Pages/${this.pascalCase(moduleName)}/Index.cshtml`;
        break;
      default:
        files = this.generateHtmlPrototype(moduleName, feature, fc);
        entryPoint = 'index.html';
        break;
    }

    // Write files to output
    const outDir = path.join(context.config.output.dir, 'prototype');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    for (const file of files) {
      const filePath = path.join(outDir, file.path);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, file.content, 'utf-8');
    }

    this.logger.info(`Rich prototype: ${files.length} file(s), framework: ${framework}`);
    return { files, entryPoint, responsive: true, interactive: true, framework };
  }

  private detectFramework(repo?: RepositoryContext): string {
    if (!repo) return 'html';
    const fwNames = repo.frameworks.map((f) => f.name.toLowerCase());
    if (fwNames.some((f) => f.includes('angular'))) return 'angular';
    if (fwNames.some((f) => f.includes('flutter'))) return 'flutter';
    if (fwNames.some((f) => f.includes('asp.net') || f.includes('blazor') || f.includes('dotnet'))) return 'dotnet';
    return 'html';
  }

  private toModuleName(feature: string): string {
    return feature
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30);
  }

  private pascalCase(str: string): string {
    return str.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  }

  // ── HTML/CSS/JS Prototype ──────────────────────────────────────────────────

  private generateHtmlPrototype(module: string, feature: string, fc: FeatureContext): { path: string; content: string }[] {
    const title = feature.charAt(0).toUpperCase() + feature.slice(1);
    const fields = this.inferFields(fc);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="app">
    <header class="header">
      <h1>${title}</h1>
      <button id="theme-toggle" class="btn btn-icon" title="Alternar tema">🌓</button>
    </header>

    <main class="main">
      <section class="card">
        <h2>Novo Registro</h2>
        <form id="main-form" class="form">
${fields.map((f) => `          <div class="form-group">
            <label for="${f.id}">${f.label}</label>
            <input type="${f.type}" id="${f.id}" name="${f.id}" ${f.required ? 'required' : ''} placeholder="${f.placeholder}">
            <span class="error-msg" id="${f.id}-error"></span>
          </div>`).join('\n')}
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Salvar</button>
            <button type="reset" class="btn btn-secondary">Limpar</button>
          </div>
        </form>
      </section>

      <section class="card">
        <h2>Registros</h2>
        <div class="table-controls">
          <input type="text" id="search-input" placeholder="Buscar..." class="search-input">
        </div>
        <div class="table-wrapper">
          <table id="data-table">
            <thead>
              <tr>
${fields.map((f) => `                <th data-sort="${f.id}">${f.label} ↕</th>`).join('\n')}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody id="table-body"></tbody>
          </table>
        </div>
        <div id="pagination" class="pagination"></div>
      </section>
    </main>

    <div id="modal" class="modal hidden">
      <div class="modal-content">
        <h3 id="modal-title">Confirmação</h3>
        <p id="modal-message"></p>
        <div class="modal-actions">
          <button id="modal-confirm" class="btn btn-primary">Confirmar</button>
          <button id="modal-cancel" class="btn btn-secondary">Cancelar</button>
        </div>
      </div>
    </div>

    <div id="toast" class="toast hidden"></div>
  </div>

  <script src="app.js"></script>
</body>
</html>`;

    const css = `:root {
  --bg: #f5f5f5; --surface: #ffffff; --text: #212121; --text-secondary: #757575;
  --primary: #1976d2; --primary-light: #e3f2fd; --danger: #d32f2f;
  --border: #e0e0e0; --radius: 8px; --shadow: 0 2px 8px rgba(0,0,0,0.1);
}
[data-theme="dark"] {
  --bg: #121212; --surface: #1e1e1e; --text: #e0e0e0; --text-secondary: #aaa;
  --primary: #90caf9; --primary-light: #1e3a5f; --danger: #ef5350;
  --border: #333; --shadow: 0 2px 8px rgba(0,0,0,0.4);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
.app { max-width: 960px; margin: 0 auto; padding: 1rem; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 2px solid var(--primary); margin-bottom: 1.5rem; }
.header h1 { font-size: 1.5rem; }
.card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.5rem; margin-bottom: 1.5rem; }
.card h2 { margin-bottom: 1rem; font-size: 1.2rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
.form-group input { width: 100%; padding: 0.6rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); font-size: 0.95rem; }
.form-group input:focus { outline: 2px solid var(--primary); border-color: var(--primary); }
.form-group input.invalid { border-color: var(--danger); }
.error-msg { font-size: 0.8rem; color: var(--danger); min-height: 1.2em; display: block; }
.form-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
.btn { padding: 0.6rem 1.2rem; border: none; border-radius: var(--radius); cursor: pointer; font-size: 0.95rem; transition: opacity 0.2s; }
.btn:hover { opacity: 0.85; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-secondary { background: var(--border); color: var(--text); }
.btn-danger { background: var(--danger); color: #fff; font-size: 0.85rem; padding: 0.4rem 0.8rem; }
.btn-icon { background: none; border: 1px solid var(--border); border-radius: 50%; width: 36px; height: 36px; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; }
.search-input { padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius); width: 100%; max-width: 300px; margin-bottom: 1rem; background: var(--surface); color: var(--text); }
.table-wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { padding: 0.6rem 0.8rem; text-align: left; border-bottom: 1px solid var(--border); }
th { cursor: pointer; user-select: none; background: var(--primary-light); font-weight: 600; }
tr:hover { background: var(--primary-light); }
.pagination { display: flex; gap: 0.5rem; margin-top: 1rem; justify-content: center; }
.pagination button { min-width: 36px; }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-content { background: var(--surface); padding: 1.5rem; border-radius: var(--radius); min-width: 300px; max-width: 90vw; }
.modal-actions { display: flex; gap: 0.5rem; margin-top: 1rem; justify-content: flex-end; }
.toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.8rem 1.2rem; border-radius: var(--radius); color: #fff; background: #388e3c; z-index: 200; transition: opacity 0.3s; }
.toast.error { background: var(--danger); }
.hidden { display: none !important; }
@media (max-width: 600px) {
  .app { padding: 0.5rem; }
  .header h1 { font-size: 1.1rem; }
  .form-actions { flex-direction: column; }
  th, td { padding: 0.4rem; font-size: 0.8rem; }
}`;

    const js = `(function() {
  'use strict';
  const FIELDS = ${JSON.stringify(fields)};
  const PAGE_SIZE = 5;
  let data = [];
  let currentPage = 1;
  let sortField = null;
  let sortAsc = true;
  let deleteIdx = -1;

  // Theme
  const toggle = document.getElementById('theme-toggle');
  toggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? '' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
  });

  // Form submit
  const form = document.getElementById('main-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const entry = {};
    FIELDS.forEach(f => { entry[f.id] = document.getElementById(f.id).value; });
    data.push(entry);
    form.reset();
    clearErrors();
    showToast('Registro salvo com sucesso!');
    renderTable();
  });

  function validateForm() {
    let valid = true;
    FIELDS.forEach(f => {
      const input = document.getElementById(f.id);
      const err = document.getElementById(f.id + '-error');
      if (f.required && !input.value.trim()) {
        input.classList.add('invalid');
        err.textContent = 'Campo obrigatório';
        valid = false;
      } else {
        input.classList.remove('invalid');
        err.textContent = '';
      }
    });
    return valid;
  }

  function clearErrors() {
    FIELDS.forEach(f => {
      document.getElementById(f.id).classList.remove('invalid');
      document.getElementById(f.id + '-error').textContent = '';
    });
  }

  // Table
  function renderTable() {
    const search = document.getElementById('search-input').value.toLowerCase();
    let filtered = data.filter(d => FIELDS.some(f => (d[f.id] || '').toLowerCase().includes(search)));
    if (sortField) {
      filtered.sort((a, b) => {
        const va = (a[sortField] || '').toLowerCase();
        const vb = (b[sortField] || '').toLowerCase();
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = page.map((row, i) =>
      '<tr>' + FIELDS.map(f => '<td>' + escapeHtml(row[f.id] || '') + '</td>').join('')
      + '<td><button class="btn btn-danger" data-idx="' + (start + i) + '">Excluir</button></td></tr>'
    ).join('');
    renderPagination(totalPages);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  document.getElementById('table-body').addEventListener('click', (e) => {
    if (e.target.dataset.idx !== undefined) {
      deleteIdx = parseInt(e.target.dataset.idx, 10);
      showModal('Confirmar exclusão', 'Deseja realmente excluir este registro?');
    }
  });

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) { sortAsc = !sortAsc; } else { sortField = field; sortAsc = true; }
      renderTable();
    });
  });

  document.getElementById('search-input').addEventListener('input', () => { currentPage = 1; renderTable(); });

  function renderPagination(totalPages) {
    const container = document.getElementById('pagination');
    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (i === currentPage ? 'btn-primary' : 'btn-secondary');
      btn.textContent = String(i);
      btn.addEventListener('click', () => { currentPage = i; renderTable(); });
      container.appendChild(btn);
    }
  }

  // Modal
  function showModal(title, msg) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = msg;
    document.getElementById('modal').classList.remove('hidden');
  }
  document.getElementById('modal-cancel').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
  });
  document.getElementById('modal-confirm').addEventListener('click', () => {
    if (deleteIdx >= 0 && deleteIdx < data.length) {
      data.splice(deleteIdx, 1);
      deleteIdx = -1;
      renderTable();
      showToast('Registro excluído.');
    }
    document.getElementById('modal').classList.add('hidden');
  });

  // Toast
  function showToast(msg, isError) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast' + (isError ? ' error' : '');
    setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  renderTable();
})();`;

    return [
      { path: 'index.html', content: html },
      { path: 'styles.css', content: css },
      { path: 'app.js', content: js },
    ];
  }

  // ── Angular Prototype ──────────────────────────────────────────────────────

  private generateAngularPrototype(module: string, feature: string, fc: FeatureContext): { path: string; content: string }[] {
    const className = this.pascalCase(module);
    const fields = this.inferFields(fc);

    const component = `import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-${module}',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './${module}.component.html',
  styleUrls: ['./${module}.component.scss'],
})
export class ${className}Component {
  form: FormGroup;
  data: any[] = [];
  searchTerm = '';

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
${fields.map((f) => `      ${f.id}: ['', ${f.required ? "Validators.required" : ''}],`).join('\n')}
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.data.push({ ...this.form.value });
    this.form.reset();
  }

  onDelete(index: number) {
    this.data.splice(index, 1);
  }
}
`;

    const template = `<div class="container">
  <h1>${feature}</h1>
  <form [formGroup]="form" (ngSubmit)="onSubmit()">
${fields.map((f) => `    <div class="form-group">
      <label>${f.label}</label>
      <input formControlName="${f.id}" placeholder="${f.placeholder}">
    </div>`).join('\n')}
    <button type="submit" [disabled]="form.invalid">Salvar</button>
  </form>
  <table *ngIf="data.length > 0">
    <thead><tr>${fields.map((f) => `<th>${f.label}</th>`).join('')}<th>Ações</th></tr></thead>
    <tbody>
      <tr *ngFor="let row of data; let i = index">
${fields.map((f) => `        <td>{{row.${f.id}}}</td>`).join('\n')}
        <td><button (click)="onDelete(i)">Excluir</button></td>
      </tr>
    </tbody>
  </table>
</div>`;

    return [
      { path: `${module}/${module}.component.ts`, content: component },
      { path: `${module}/${module}.component.html`, content: template },
      { path: `${module}/${module}.component.scss`, content: '/* Styles go here */\n.container { padding: 1rem; max-width: 960px; margin: 0 auto; }\n.form-group { margin-bottom: 1rem; }\n.form-group label { display: block; font-weight: bold; }\n.form-group input { width: 100%; padding: 0.5rem; }\ntable { width: 100%; border-collapse: collapse; margin-top: 1rem; }\nth, td { padding: 0.5rem; border: 1px solid #ddd; text-align: left; }\n' },
    ];
  }

  // ── Flutter Prototype ──────────────────────────────────────────────────────

  private generateFlutterPrototype(module: string, feature: string, fc: FeatureContext): { path: string; content: string }[] {
    const className = this.pascalCase(module);
    const fields = this.inferFields(fc);

    const page = `import 'package:flutter/material.dart';

class ${className}Page extends StatefulWidget {
  const ${className}Page({super.key});
  @override
  State<${className}Page> createState() => _${className}PageState();
}

class _${className}PageState extends State<${className}Page> {
  final _formKey = GlobalKey<FormState>();
${fields.map((f) => `  final _${f.id}Controller = TextEditingController();`).join('\n')}
  final List<Map<String, String>> _data = [];

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _data.add({
${fields.map((f) => `        '${f.id}': _${f.id}Controller.text,`).join('\n')}
      });
${fields.map((f) => `      _${f.id}Controller.clear();`).join('\n')}
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Registro salvo com sucesso!')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('${feature}')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Form(
                  key: _formKey,
                  child: Column(children: [
${fields.map((f) => `                    TextFormField(
                      controller: _${f.id}Controller,
                      decoration: const InputDecoration(labelText: '${f.label}'),
                      validator: (v) => ${f.required ? "(v == null || v.isEmpty) ? 'Campo obrigatório' : null" : 'null'},
                    ),`).join('\n')}
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: _submit, child: const Text('Salvar')),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (_data.isNotEmpty)
              DataTable(
                columns: [
${fields.map((f) => `                  const DataColumn(label: Text('${f.label}')),`).join('\n')}
                  const DataColumn(label: Text('Ações')),
                ],
                rows: _data.asMap().entries.map((e) => DataRow(cells: [
${fields.map((f) => `                  DataCell(Text(e.value['${f.id}'] ?? '')),`).join('\n')}
                  DataCell(IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () => setState(() => _data.removeAt(e.key)),
                  )),
                ])).toList(),
              ),
          ],
        ),
      ),
    );
  }
}
`;

    return [{ path: `lib/features/${module}/${module}_page.dart`, content: page }];
  }

  // ── .NET Prototype ─────────────────────────────────────────────────────────

  private generateDotNetPrototype(module: string, feature: string, fc: FeatureContext): { path: string; content: string }[] {
    const className = this.pascalCase(module);
    const fields = this.inferFields(fc);

    const cshtml = `@page
@model ${className}Model
<h1>${feature}</h1>
<form method="post">
${fields.map((f) => `  <div class="mb-3">
    <label class="form-label">${f.label}</label>
    <input asp-for="${this.pascalCase(f.id)}" class="form-control" placeholder="${f.placeholder}" />
  </div>`).join('\n')}
  <button type="submit" class="btn btn-primary">Salvar</button>
</form>`;

    const model = `using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

public class ${className}Model : PageModel
{
${fields.map((f) => `    [BindProperty] public string ${this.pascalCase(f.id)} { get; set; } = string.Empty;`).join('\n')}

    public void OnGet() { }

    public IActionResult OnPost()
    {
        if (!ModelState.IsValid) return Page();
        // Save logic
        return RedirectToPage();
    }
}
`;

    return [
      { path: `Pages/${className}/Index.cshtml`, content: cshtml },
      { path: `Pages/${className}/Index.cshtml.cs`, content: model },
    ];
  }

  // ── Field inference ────────────────────────────────────────────────────────

  private inferFields(fc: FeatureContext): { id: string; label: string; type: string; required: boolean; placeholder: string }[] {
    // Attempt to infer from database schema or requirements
    const fields: { id: string; label: string; type: string; required: boolean; placeholder: string }[] = [];

    if (fc.databaseSummary) {
      // Use first table columns as fields hint
      const tables = (fc.databaseSummary as any)?.tables;
      if (Array.isArray(tables) && tables.length > 0) {
        const table = tables[0];
        for (const col of (table.columns || []).slice(0, 6)) {
          fields.push({
            id: col.name.toLowerCase().replace(/\s+/g, '_'),
            label: col.name,
            type: col.type?.toLowerCase().includes('int') ? 'number' : 'text',
            required: !col.nullable,
            placeholder: `Informe ${col.name}`,
          });
        }
        return fields;
      }
    }

    // Default generic fields for Brazilian-style CRUD
    return [
      { id: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: João da Silva' },
      { id: 'email', label: 'E-mail', type: 'email', required: true, placeholder: 'Ex: joao@email.com' },
      { id: 'telefone', label: 'Telefone', type: 'tel', required: false, placeholder: 'Ex: (11) 99999-0000' },
      { id: 'observacao', label: 'Observação', type: 'text', required: false, placeholder: 'Detalhes adicionais' },
    ];
  }
}
