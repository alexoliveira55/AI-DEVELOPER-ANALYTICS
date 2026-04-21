// ── Language Configuration ────────────────────────────────────────────────────

export const DEFAULT_LANGUAGE = 'pt-BR';

export interface LanguageConfig {
  language: string;
}

// ── Centralized Labels – Portuguese (pt-BR) ──────────────────────────────────
// All user-facing text used across agents and output generators.
// Variable names, JSON keys, file names, and technical logs remain in English.

export const Labels = {
  // ── Common ──────────────────────────────────────────────
  common: {
    yes: 'Sim',
    no: 'Não',
    none: 'nenhum',
    unknown: 'desconhecido',
    new: 'Novo',
    modified: 'Modificado',
    noData: 'Sem dados disponíveis',
    generatedAt: 'Gerado em',
    feature: 'Funcionalidade',
    component: 'Componente',
    type: 'Tipo',
    description: 'Descrição',
    status: 'Status',
    file: 'Arquivo',
    files: 'Arquivos',
    name: 'Nome',
    value: 'Valor',
    metric: 'Métrica',
    detail: 'Detalhe',
    aspect: 'Aspecto',
    category: 'Categoria',
    priority: 'Prioridade',
    dependencies: 'Dependências',
    methods: 'métodos',
    columns: 'colunas',
    actions: 'ações',
    entity: 'entidade',
    total: 'Total',
  },

  // ── Requirements ────────────────────────────────────────
  requirements: {
    title: 'Análise de Requisitos',
    functional: 'Requisitos Funcionais',
    nonFunctional: 'Requisitos Não Funcionais',
    assumptions: 'Premissas',
    constraints: 'Restrições',
    noAnalysis: '_Nenhuma análise de requisitos foi gerada._',
    businessRules: 'Regras de Negócio',
    id: 'ID',
    // Agent-generated descriptions
    enforceAuth: 'Garantir autenticação e autorização usando a infraestrutura de auth existente',
    validatePermissions: 'Validar permissões do usuário antes de operações de criação/atualização/exclusão',
    exposeEndpoints: (methods: string) =>
      `Expor endpoints RESTful seguindo convenções existentes (métodos: ${methods})`,
    applyValidation: 'Aplicar validação de entrada usando a infraestrutura de validação existente',
    implementPersistence: (count: number) =>
      `Implementar persistência de dados usando o padrão Repository (${count} repositórios existentes detectados)`,
    followErrorHandling: 'Seguir padrões de tratamento de erros existentes para respostas consistentes',
    integrateLogging: 'Integrar com infraestrutura de logging/monitoramento existente',
    integrateDbTables: (tables: string) =>
      `Integrar com tabelas existentes no banco de dados: ${tables}`,
    tableRequiredFields: (table: string, fields: string) =>
      `A tabela ${table} possui campos obrigatórios: ${fields}`,
    storedProcUpdates: (procs: string) =>
      `Stored procedures existentes podem necessitar atualização: ${procs}`,
    repoFollows: (pattern: string) =>
      `O repositório segue o padrão arquitetural ${pattern}`,
    frameworkStack: (frameworks: string) =>
      `A implementação utilizará o stack de frameworks existente: ${frameworks}`,
    primaryLanguage: (lang: string, pct: string) =>
      `A linguagem principal de implementação é ${lang} (${pct}% do codebase)`,
    mustFollowPatterns: (patterns: string) =>
      `Deve seguir os padrões existentes: ${patterns}`,
    apiRouteConvention: (prefixes: string) =>
      `Rotas da API devem seguir a convenção de prefixo existente (existentes: ${prefixes})`,
    mustUseDI: 'Novos serviços devem usar injeção de dependência consistente com o codebase existente',
  },

  // ── Scope ───────────────────────────────────────────────
  scope: {
    title: 'Definição de Escopo',
    inScope: 'Dentro do Escopo',
    outOfScope: 'Fora do Escopo',
    affectedModules: 'Módulos Afetados',
    newModules: 'Novos Módulos',
    estimatedComplexity: 'Complexidade Estimada',
    area: 'Área',
    // Agent descriptions
    modifyService: (path: string, hint: string) =>
      `Modificar serviço existente em ${path}${hint}`,
    methodsToReview: (methods: string) => ` (métodos a revisar: ${methods})`,
    modifyController: (path: string, hint: string) =>
      `Modificar controlador existente em ${path}${hint}`,
    actionsHint: (actions: string) => ` (ações: ${actions})`,
    extendDataAccess: (path: string, entity: string) =>
      `Estender camada de acesso a dados em ${path} (entidade: ${entity})`,
    reviewEndpoints: (count: number, routes: string) =>
      `Revisar/modificar ${count} endpoint(s) existente(s): ${routes}`,
    reviewDbScript: (type: string, path: string, tables: string) =>
      `Revisar script ${type} em ${path} (tabelas: ${tables})`,
    integrateTable: (table: string, cols: number, pk: string) =>
      `Integrar com tabela ${table} (${cols} colunas, PK: ${pk || 'nenhuma'})`,
    newMigrationRequired: 'Nova(s) migração(ões) de banco de dados necessária(s) para entidades da funcionalidade',
    newModuleFor: (category: string) =>
      `Novo módulo para requisitos de ${category}`,
    apiIntegration: 'Integração de endpoints da API e configuração de rotas',
    databaseMigration: 'migração de banco de dados',
  },

  // ── Reuse ───────────────────────────────────────────────
  reuse: {
    title: 'Análise de Reuso',
    reuseScore: 'Pontuação de Reuso',
    candidates: 'Candidatos ao Reuso',
    reusableAssets: 'Ativos Reutilizáveis',
    relevance: 'Relevância',
    reason: 'Motivo',
    noRepoContext: 'Contexto de repositório não disponível — não foi possível identificar ativos reutilizáveis.',
    existingComponent: (category: string, path: string, hint: string) =>
      `${category} existente em ${path}${hint}`,
    exportsHint: (exports: string) => `: exporta ${exports}`,
    reuseMethods: (methods: string, path: string, depHint: string) =>
      `Reutilizar métodos: ${methods} de ${path}${depHint}`,
    serviceMatchesDomain: (name: string, depHint: string) =>
      `Serviço ${name} corresponde ao domínio da funcionalidade${depHint}`,
    reuseDataAccess: (methods: string, entityHint: string) =>
      `Reutilizar métodos de acesso a dados: ${methods}${entityHint}`,
    repoMatchesDomain: (entityHint: string) =>
      `Repositório corresponde ao domínio da funcionalidade${entityHint}`,
    reuseEndpointPatterns: (patterns: string, basePath: string) =>
      `Reutilizar padrões de endpoint: ${patterns}${basePath}`,
    controllerSameDomain: (basePath: string) =>
      `Controlador segue o mesmo padrão de domínio${basePath}`,
    followRoutePatterns: (patterns: string) =>
      `Seguir padrões de rota existentes: ${patterns}`,
    existingDbScript: (type: string, tables: string) =>
      `Script ${type} existente para tabelas: ${tables} — usar como modelo`,
    summaryFound: (total: number, high: number, medium: number, score: number, assets: number) =>
      `Encontrado(s) ${total} ativo(s) reutilizável(is): ${high} alta, ${medium} média relevância. ` +
      `Pontuação de reuso: ${score}% de ${assets} ativos do codebase atendem aos requisitos da funcionalidade.`,
    summaryNone: (assets: number) =>
      `Nenhum componente existente corresponde aos requisitos entre ${assets} ativos do codebase. Novas implementações serão necessárias.`,
  },

  // ── Solution Architecture ───────────────────────────────
  solution: {
    title: 'Arquitetura da Solução',
    overview: 'Visão Geral',
    proposedComponents: 'Componentes Propostos',
    integrations: 'Integrações',
    dataFlows: 'Fluxos de Dados',
    technologyStack: 'Stack Tecnológico',
    componentDiagram: 'Diagrama de Componentes',
    dataFlowDiagram: 'Diagrama de Fluxo de Dados',
    noSolution: '_Nenhuma arquitetura de solução foi gerada._',
    // Agent descriptions
    coreBusinessLogic: (module: string) =>
      `Lógica de negócio principal para ${module} — trata validação, regras de negócio e orquestração`,
    restController: (module: string, prefix: string) =>
      `Controlador REST para ${module} — endpoints ${prefix}/${module}s (CRUD + ações customizadas)`,
    dataAccessLayer: (module: string, pattern: string) =>
      `Camada de acesso a dados para ${module} — implementa ${pattern} para operações de persistência`,
    domainEntity: (module: string, hint: string) =>
      `Entidade de domínio para ${module}${hint}`,
    dbMigration: (module: string) =>
      `Migração de banco de dados para criar tabela ${module} com colunas e índices necessários`,
    authGuard: (module: string) =>
      `Guard de autorização para ${module} — valida permissões em operações protegidas`,
    createDto: (module: string) =>
      `DTO de validação de entrada para criação de ${module} com regras de validação por campo`,
    updateDto: (module: string) =>
      `DTO de validação de entrada para atualização de ${module} (campos parciais)`,
    extendService: (name: string, path: string, count: number) =>
      `Estender ${name} em ${path} — adicionar novos métodos para integração da funcionalidade (métodos atuais: ${count})`,
    extendController: (name: string, path: string, count: number) =>
      `Estender ${name} em ${path} — adicionar novas ações (ações atuais: ${count})`,
    extendRepository: (name: string, path: string, entity: string) =>
      `Estender ${name} em ${path} — adicionar novos métodos de consulta (entidade: ${entity})`,
    extendExisting: (name: string) =>
      `Estender ${name} existente com nova funcionalidade`,
    extendWithReuse: (name: string, existing: string, path: string, methods: string) =>
      `Estender ${existing} (${path}) ao invés de criar novo — reutilizar métodos: ${methods}. Adicionar somente a lógica de ${name} que não existe.`,
    reuseInsteadOfNew: (existing: string, path: string) =>
      `Componente existente ${existing} (${path}) cobre esta necessidade — reutilizar ao invés de criar novo`,
    reusesComponent: (source: string, target: string, type: string, path: string) =>
      `${source} reutiliza ${target} (${type} em ${path})`,
    dependsOnExisting: (source: string, target: string) =>
      `${source} depende do ${target} existente`,
    considerReuse: (name: string, type: string) =>
      `Considerar reutilizar ${name} (${type}) — correspondência de relevância média`,
    httpRequest: (prefix: string, module: string) =>
      `Requisição HTTP (${prefix}/${module})`,
    incomingRequest: 'Requisição REST API de entrada com validação',
    validatedDto: (module: string) => `${module}Dto`,
    dtoToService: 'DTO validado enviado à camada de serviço para lógica de negócio',
    entityLabel: (base: string) => `entidade ${base}`,
    serviceToPersistence: 'Serviço delega operações de persistência ao repositório',
    sqlOrmQuery: 'SQL / consulta ORM',
    repoToDb: 'Repositório executa operações no banco de dados',
    jsonResponse: 'Resposta JSON',
    serializedResponse: 'Resposta serializada com código de status e dados',
    overviewText: (newCount: number, modCount: number, arch: string, patterns: string, intCount: number, stack: string, complexity: string) =>
      `A solução propõe ${newCount} novo(s) componente(s) e ${modCount} modificação(ões) ` +
      `alinhados com a arquitetura ${arch}${patterns}. ` +
      `${intCount} ponto(s) de integração com código existente. ` +
      `Stack tecnológico: ${stack}. ` +
      `Complexidade estimada: ${complexity}.`,
    repositoryPattern: 'Padrão Repository',
    dataAccess: 'acesso a dados',
    reference: (table: string, cols: number) =>
      ` (referência: ${table} com ${cols} colunas)`,
    client: 'Cliente',
    database: 'Banco de Dados',
  },

  // ── Implementation Plan ─────────────────────────────────
  implementationPlan: {
    title: 'Plano de Implementação',
    overview: 'Este plano detalha a implementação da funcionalidade seguindo as melhores práticas de arquitetura de software, evitando refatorações de alto risco e aplicando princípios de clean code.',
    phases: 'Fases de Implementação',
    cleanCodePractices: 'Práticas de Clean Code',
    testingStrategy: 'Estratégia de Testes',
    deploymentApproach: 'Abordagem de Deploy',
    riskAssessment: 'Avaliação de Riscos',
    estimatedTimeline: 'Cronograma Estimado',
    successCriteria: 'Critérios de Sucesso',
    currentArchitecture: 'Arquitetura Atual',
    implementationPhases: 'Fases de Implementação',
    phase: 'Fase',
    components: 'Componentes',
    tasks: 'Tarefas',
    duration: 'Duração',
    dependencies: 'Dependências',
    practice: 'Prática',
    approach: 'Abordagem',
    types: 'Tipos',
    tools: 'Ferramentas',
    coverage: 'Cobertura',
    strategy: 'Estratégia',
    steps: 'Passos',
    rollback: 'Rollback',
    level: 'Nível',
    factors: 'Fatores',
    mitigations: 'Mitigações',
    timeline: 'Cronograma',
    criteria: 'Critérios',
  },

  // ── Impact Analysis ─────────────────────────────────────
  impact: {
    title: 'Análise de Impacto',
    riskLevel: 'Nível de Risco',
    impactedAreas: 'Áreas Impactadas',
    breakingChanges: 'Mudanças com Quebra',
    testingRecommendations: 'Recomendações de Teste',
    migrationNotes: 'Notas de Migração',
    noAnalysis: '_Nenhuma análise de impacto foi gerada._',
    impact: 'Impacto',
    // Agent descriptions
    serviceModification: (path: string, count: number, consumers: string) =>
      `Modificação de serviço em ${path} — ${count} consumidor(es) downstream: ${consumers || 'nenhum'}`,
    regressionTests: (name: string, count: number, consumers: string) =>
      `Testes de regressão para ${name} + ${count} consumidor(es): ${consumers || 'somente testes diretos'}`,
    verifySignature: (name: string, count: number, methods: string) =>
      `${name} possui ${count} método(s) público(s) — verificar compatibilidade de assinatura: ${methods}`,
    controllerModification: (path: string, count: number) =>
      `Modificação de controlador em ${path} — ${count} ação(ões) existente(s) podem necessitar atualização`,
    apiContractTests: (name: string, actions: string) =>
      `Testes de contrato da API para ${name} — verificar ${actions}`,
    repoModification: (path: string, entity: string, count: number) =>
      `Modificação de repositório em ${path} (entidade: ${entity}) — ${count} método(s) existente(s)`,
    routeConflict: (name: string) => `Conflito de rota: ${name}`,
    routeConflictDesc: (name: string, count: number, routes: string) =>
      `Novo controlador ${name} pode conflitar com ${count} rota(s) existente(s): ${routes}`,
    routeConflictBreaking: (name: string, routes: string) =>
      `Potencial conflito de rota entre ${name} e endpoints existentes: ${routes}`,
    routingLayer: 'Camada de roteamento da API',
    verifyRouting: (count: number) =>
      `${count} novo(s) controlador(es) — verificar registro no módulo de rotas e cadeia de middleware`,
    dbSchema: 'Esquema do banco de dados',
    migrationsRequired: (count: number, names: string, relatedCount: number) =>
      `${count} migração(ões) necessária(s): ${names}. ${relatedCount} script(s) existente(s) referenciam tabelas relacionadas.`,
    runMigrations: (count: number) =>
      `Executar ${count} migração(ões) de banco de dados antes do deploy`,
    createRollback: 'Criar scripts de rollback para cada migração',
    verifyMigrationStaging: 'Verificar migração do banco de dados em ambiente de staging antes de produção',
    validateRollback: 'Validar procedimento de rollback para cada migração',
    fkImplication: (table: string, related: string) =>
      `A tabela ${table} pode necessitar de chaves estrangeiras para: ${related}`,
    sharedComponents: 'Componentes compartilhados',
    sharedComponentsDesc: (count: number, details: string) =>
      `${count} componente(s) compartilhado(s) serão consumidos pelo novo código: ${details}`,
    highReuseImpact: (name: string, path: string, consumers: number) =>
      `⚠️ ${name} (${path}) é altamente reutilizado (${consumers} consumidor(es)). Modificações devem preservar contratos existentes para não quebrar dependentes.`,
    preserveLegacy: (name: string, methods: string) =>
      `Preservar assinaturas existentes de ${name}: ${methods} — adicionar novos métodos sem alterar os atuais`,
    integrationComplexity: 'Complexidade de integração',
    integrationComplexityDesc: (count: number) =>
      `${count} pontos de integração — alto risco de acoplamento. Considere padrão facade para reduzir dependências.`,
    integrationTests: (count: number) =>
      `Testes de integração para todos os ${count} pontos de integração`,
    modifiedComponentsBreaking: (count: number) =>
      `${count} componente(s) existente(s) serão modificados — verificar compatibilidade da API com todos os consumidores`,
    unitTests: (count: number) => `Testes unitários para ${count} novo(s) componente(s)`,
    dataFlowIntegrationTests: (count: number) =>
      `Testes de integração para ${count} fluxo(s) de dados`,
    securityTests: (count: number, names: string) =>
      `Testes de segurança para ${count} novo(s) guard(s)/middleware: ${names}`,
    e2eRegression: 'Suíte de testes de regressão end-to-end',
  },

  // ── Estimation ──────────────────────────────────────────
  estimation: {
    title: 'Estimativa',
    totalHours: 'Total de Horas Estimadas',
    confidence: 'Confiança',
    complexity: 'Complexidade',
    effort: 'Esforço',
    breakdown: 'Detalhamento',
    task: 'Tarefa',
    hours: 'Horas',
    noEstimation: '_Nenhuma estimativa foi gerada._',
    effortDistribution: 'Distribuição do Esforço',
    tasks: 'Tarefas',
    // Task templates
    codebaseComprehension: (modules: number, lines: string) =>
      `Compreensão do codebase (${modules} módulo(s) afetado(s), ${lines} linhas totais)`,
    implement: (name: string, type: string) => `Implementar ${name} (${type})`,
    modify: (name: string, path: string, methods: number) =>
      `Modificar ${name}${path ? ` (${path})` : ''} — ${methods} método(s) existente(s)`,
    dependencyWiring: (count: number) =>
      `Integração de dependências (${count} integração(ões) direta(s))`,
    crossServiceIntegration: (count: number) =>
      `Integração cross-service (${count} ponto(s))`,
    optionalReuseIntegration: (count: number) =>
      `Integração de reuso opcional (${count} candidato(s))`,
    dataFlowImplementation: (count: number) =>
      `Implementação de fluxo de dados (${count} fluxos incluindo DTOs, serialização)`,
    unitTestTask: (count: number) =>
      `Testes unitários para ${count} novo(s) componente(s)`,
    integrationTestTask: (count: number) =>
      `Testes de integração (${count} ponto(s) de integração)`,
    regressionTest: (risk: string) =>
      `Testes de regressão (risco: ${risk})`,
    dbMigrationTest: (count: number) =>
      `Verificação de migração e rollback de banco de dados (${count} nota(s))`,
    securityTest: 'Testes de segurança e autorização',
    codeReview: 'Revisão de código e documentação',
    frameworkFamiliarization: (frameworks: string) =>
      `Familiarização com frameworks (${frameworks})`,
    // Categories
    catTesting: 'Testes',
    catDatabase: 'Banco de Dados',
    catAnalysis: 'Análise',
    catIntegration: 'Integração',
    catReview: 'Revisão',
    catImplementation: 'Implementação',
  },

  // ── Documentation ───────────────────────────────────────
  documentation: {
    title: 'Documentação',
    solutionAnalysis: (feature: string) => `Análise da Solução: ${feature}`,
    tableOfContents: 'Índice',
    repositoryOverview: 'Visão Geral do Repositório',
    languageBreakdown: 'Distribuição por Linguagem',
    detectedFrameworks: 'Frameworks Detectados',
    requirements: 'Requisitos',
    scope: 'Escopo',
    reuseAnalysis: 'Análise de Reuso',
    solutionArchitecture: 'Arquitetura da Solução',
    impactAnalysis: 'Análise de Impacto',
    estimation: 'Estimativa',
    summary: 'Resumo',
    noDocumentation: '_Nenhuma documentação foi gerada._',
    // Table of contents labels
    toc: [
      { anchor: 'visão-geral-do-repositório', label: 'Visão Geral do Repositório' },
      { anchor: 'requisitos', label: 'Requisitos' },
      { anchor: 'escopo', label: 'Escopo' },
      { anchor: 'análise-de-reuso', label: 'Análise de Reuso' },
      { anchor: 'arquitetura-da-solução', label: 'Arquitetura da Solução' },
      { anchor: 'análise-de-impacto', label: 'Análise de Impacto' },
      { anchor: 'estimativa', label: 'Estimativa' },
      { anchor: 'resumo', label: 'Resumo' },
    ],
    // Table headers
    project: 'Projeto',
    totalFiles: 'Total de arquivos',
    totalLines: 'Total de linhas',
    architecture: 'Arquitetura',
    services: 'Serviços',
    controllers: 'Controladores',
    repositories: 'Repositórios',
    apiEndpoints: 'Endpoints da API',
    language: 'Linguagem',
    lines: 'Linhas',
    percentage: '%',
    framework: 'Framework',
    version: 'Versão',
    confidence: 'Confiança',
    newQuestion: 'Novo?',
    source: 'Origem',
    target: 'Destino',
    // Summary labels
    newComponents: 'Novos componentes',
    modifiedComponents: 'Componentes modificados',
    reusableAssets: 'Ativos reutilizáveis',
    estimatedHours: 'Horas estimadas',
  },

  // ── Prototype ───────────────────────────────────────────
  prototype: {
    title: 'Protótipo',
    description: 'Descrição',
    components: 'Componentes',
    statusLabel: 'Status',
    readmeDescription: (desc: string) =>
      `Scaffold de protótipo gerado automaticamente para: **${desc}**`,
    frameworkLabel: 'Framework',
    languageLabel: 'Linguagem',
    statusChecklist: [
      'Implementação',
      'Testes',
      'Documentação',
    ],
    dataFlowTitle: 'Fluxo de Dados',
    gettingStarted: 'Como Começar',
    installDeps: 'Instalar dependências',
    runTests: 'Executar os testes',
    startDev: 'Iniciar servidor de desenvolvimento',
  },

  // ── LLM Prompt Instruction ──────────────────────────────
  llm: {
    languageInstruction: 'Responda sempre em Português do Brasil (pt-BR).',
  },

  // ── Git Analysis ────────────────────────────────────────
  git: {
    title: 'Análise do Git',
    commits: 'Commits',
    authors: 'Autores',
    branches: 'Branches',
    hotFiles: 'Arquivos Mais Alterados',
    recentCommits: 'Commits Recentes',
    totalCommits: 'Total de Commits',
    activeBranch: 'Branch Ativo',
    noGitRepo: 'Repositório Git não encontrado.',
    author: 'Autor',
    commitCount: 'Nº de Commits',
    file: 'Arquivo',
    changes: 'Alterações',
  },

  // ── Project Discovery ───────────────────────────────────
  projectDiscovery: {
    title: 'Descoberta de Projetos',
    discoveredProjects: 'Projetos Descobertos',
    monorepo: 'Monorepo',
    totalProjects: 'Total de Projetos',
    projectName: 'Nome do Projeto',
    projectType: 'Tipo',
    projectPath: 'Caminho',
    noProjects: 'Nenhum projeto/subprojeto encontrado.',
  },

  // ── Flowchart ───────────────────────────────────────────
  flowchart: {
    title: 'Fluxogramas',
    mainFlow: 'Fluxo Principal',
    sequenceDiagram: 'Diagrama de Sequência',
    classDiagram: 'Diagrama de Classes',
    noFlowcharts: '_Nenhum fluxograma foi gerado._',
  },

  // ── Documentation Variants ──────────────────────────────
  docVariants: {
    technicalTitle: 'Documentação Técnica',
    executiveTitle: 'Documento Executivo',
    summaryTitle: 'Resumo',
    noTechnical: '_Nenhuma documentação técnica foi gerada._',
    noExecutive: '_Nenhum documento executivo foi gerado._',
    noSummary: '_Nenhum resumo foi gerado._',
  },

  // ── Language Specialists ────────────────────────────────
  languageSpecialist: {
    title: 'Análise por Linguagem',
    language: 'Linguagem',
    patterns: 'Padrões',
    recommendations: 'Recomendações',
    bestPractices: 'Melhores Práticas',
    antiPatterns: 'Anti-Padrões',
    noAnalysis: '_Nenhuma análise específica por linguagem foi gerada._',
  },

  // ── Rich Prototype ─────────────────────────────────────
  richPrototype: {
    title: 'Protótipo Interativo',
    framework: 'Framework Detectado',
    filesGenerated: 'Arquivos Gerados',
    entryPoint: 'Ponto de Entrada',
    responsive: 'Responsivo',
    interactive: 'Interativo',
    noPrototype: '_Nenhum protótipo rico foi gerado._',
  },

  // ── Code Implementation ─────────────────────────────────
  implementation: {
    title: 'Implementação de Código',
    sourceFiles: 'Arquivos de Código-Fonte',
    testFiles: 'Arquivos de Teste',
    configFiles: 'Arquivos de Configuração',
    setupInstructions: 'Instruções de Setup',
    testCommands: 'Comandos de Teste',
    totalFiles: 'Total de Arquivos',
    totalLines: 'Total de Linhas',
    language: 'Linguagem',
    framework: 'Framework',
    fileType: 'Tipo',
    noImplementation: '_Nenhuma implementação de código foi gerada._',
    generatedBy: 'Gerado pelo AI Developer Analytics',
    summary: 'Resumo da Implementação',
  },
};
