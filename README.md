# AI Developer Analytics

Sistema de análise de software baseado em **agentes inteligentes**, integrado ao **GitHub Copilot Chat** via [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

Analisa repositórios, gera requisitos, arquitetura de solução, estimativas de esforço, documentação e protótipos — tudo acessível diretamente no VS Code.

---

## Funcionalidades

| Ferramenta | Descrição |
|---|---|
| `analyze_repository` | Visão geral: linguagens, frameworks, arquitetura, endpoints, Git |
| `generate_requirements` | Requisitos funcionais e não-funcionais a partir de uma descrição |
| `generate_full_analysis` | Pipeline completo: requisitos → escopo → solução → impacto → estimativa → documentação |
| `estimate_effort` | Estimativa de horas com breakdown por tarefa |
| `generate_solution` | Arquitetura da solução com componentes, integrações e fluxogramas |
| `generate_prototype` | Protótipo interativo (HTML/Angular/Flutter/.NET) |

---

## Arquitetura

```
GitHub Copilot Chat → MCP (stdio) → MCP Server → Orchestrator → 18 Agentes → Resultado
```

### Pipeline de 18 Agentes

| # | Agente | Função |
|---|---|---|
| 1 | RepositoryIndexer | Escaneia linguagens, frameworks, APIs, banco de dados |
| 2 | GitAnalyzer | Histórico de commits, autores, branches, hotspots |
| 3 | ProjectDiscovery | Detecta monorepo, sub-projetos, dependências compartilhadas |
| 4 | AttachmentReader | Lê e interpreta arquivos anexados |
| 5 | DatabaseReader | Schema de banco de dados (PostgreSQL, MySQL, MSSQL) |
| 6 | Requirements | Análise de requisitos funcionais e não-funcionais |
| 7 | Scope | Definição de escopo e complexidade |
| 8 | Reuse | Identifica componentes reutilizáveis |
| 9 | SolutionArchitect | Arquitetura proposta com componentes e integrações |
| 10 | LanguageSpecialists | Análise especializada por linguagem (C#, Angular, Python, SQL, etc.) |
| 11 | ImpactAnalysis | Avaliação de impacto e riscos |
| 12 | Estimation | Estimativa de esforço em horas |
| 13 | FlowchartGenerator | Diagramas Mermaid (fluxo, sequência, classes) |
| 14 | TechnicalWriter | Documentação técnica detalhada |
| 15 | ExecutiveWriter | Resumo executivo para stakeholders |
| 16 | SummaryGenerator | Resumo condensado da análise |
| 17 | Documentation | Geração de documentação consolidada |
| 18 | RichPrototype | Protótipo interativo com tema claro/escuro |

---

## Instalação Rápida (Desenvolvimento)

```bash
# Clonar e instalar dependências
git clone <url-do-repositorio>
cd ai-developer-analytics
npm install

# Compilar
npm run build

# Testar o MCP Server localmente
npm run mcp
```

---

## Uso com GitHub Copilot Chat (VS Code)

### Opção 1: Via Node.js (recomendado para desenvolvimento)

Adicione ao arquivo `.vscode/settings.json` do projeto que deseja analisar:

```json
{
  "mcp": {
    "servers": {
      "ai-developer-analytics": {
        "type": "stdio",
        "command": "node",
        "args": ["<caminho-absoluto>/ai-developer-analytics/dist/mcp-server.js"]
      }
    }
  }
}
```

### Opção 2: Via executável (.exe)

Se você gerou o `.exe` (veja seção "Distribuição" abaixo):

```json
{
  "mcp": {
    "servers": {
      "ai-developer-analytics": {
        "type": "stdio",
        "command": "<caminho>/ai-mcp.exe"
      }
    }
  }
}
```

### Como utilizar

1. Abra o VS Code no projeto que deseja analisar
2. Configure o `settings.json` conforme acima
3. Abra o **Copilot Chat** (Ctrl+Shift+I)
4. Selecione o modo **Agent** no chat
5. Pergunte naturalmente:

```
Analise este repositório e me dê uma visão geral
```

```
Quais os requisitos para implementar um cadastro de clientes com validação de CPF?
```

```
Estime o esforço para criar uma API REST de produtos com CRUD completo
```

```
Gere a arquitetura da solução para um módulo de relatórios financeiros
```

---

## Distribuição (Gerar .exe)

Para distribuir o MCP Server como executável standalone (sem necessidade de Node.js na máquina destino):

### 1. Gerar o executável

```bash
# Build + empacotamento em um comando
npm run dist
```

Isso gera `ai-mcp.exe` na raiz do projeto.

### 2. Distribuir para a equipe

Copie para a máquina destino:
- `ai-mcp.exe`
- Pasta `prompts/` (opcional — apenas se usar LLM)

### 3. Configurar no VS Code da máquina destino

Coloque o executável em uma pasta acessível (ex: `C:\tools\ai-mcp.exe`) e configure o `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "ai-developer-analytics": {
        "type": "stdio",
        "command": "C:\\tools\\ai-mcp.exe"
      }
    }
  }
}
```

### 4. Passo a Passo Completo para Distribuição

| Passo | Quem | Ação |
|---|---|---|
| 1 | Desenvolvedor | `npm run dist` → gera `ai-mcp.exe` |
| 2 | Desenvolvedor | Envia `ai-mcp.exe` para compartilhamento/rede |
| 3 | Destinatário | Copia `.exe` para pasta local (ex: `C:\tools\`) |
| 4 | Destinatário | Abre VS Code → Settings → busca "mcp" |
| 5 | Destinatário | Edita `settings.json` com configuração acima |
| 6 | Destinatário | Recarrega VS Code (Ctrl+Shift+P → "Reload Window") |
| 7 | Destinatário | Abre Copilot Chat → modo Agent → usa normalmente |

> **Nota**: A máquina destino **não precisa** ter Node.js, npm ou qualquer dependência instalada. Basta o `.exe` e o VS Code com GitHub Copilot ativo.

---

## CLI (uso standalone)

O projeto também oferece uma interface de linha de comando:

```bash
# Gerar análise completa
npm run generate "Cadastro de clientes com validação de CPF"

# Apenas indexar repositório
npx ai-cli index --project .

# Ler schema de banco de dados
npx ai-cli db-read --connection "postgresql://user:pass@host/db"
```

---

## Configuração

**Prioridade** (maior → menor): Flags CLI → Variáveis de ambiente → `ai-config.json` → Valores padrão.

### Variáveis de ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `AI_PROVIDER` | Provedor de LLM | `openai`, `anthropic` |
| `AI_API_KEY` | Chave da API | `sk-...` |
| `AI_MODEL` | Modelo a usar | `gpt-4o`, `claude-3-opus` |
| `EXECUTION_MODE` | Modo de execução | `LLM_ONLINE`, `LLM_OFFLINE`, `REPOSITORY_ONLY` |
| `LOG_LEVEL` | Nível de log | `info`, `debug`, `warn` |
| `DB_CONNECTION_STRING` | Conexão com banco | `postgresql://...` |
| `DB_PROVIDER` | Tipo de banco | `postgres`, `mysql`, `mssql` |

### Arquivo de configuração (`ai-config.json`)

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "executionMode": "REPOSITORY_ONLY",
  "language": "pt-BR"
}
```

---

## Modos de Execução

| Modo | Descrição |
|---|---|
| `LLM_ONLINE` | Usa LLM para gerar análises detalhadas |
| `LLM_OFFLINE` | Fallback heurístico quando API falha |
| `REPOSITORY_ONLY` | Apenas análise estática (sem LLM), 12 agentes |

O modo `REPOSITORY_ONLY` funciona completamente **offline** e é o padrão quando nenhuma API key está configurada.

---

## Estrutura do Projeto

```
src/
  mcp-server.ts          # Entry point do MCP Server
  cli.ts                 # Entry point da CLI
  index.ts               # Registro de comandos CLI
  agents/                # 18 agentes do pipeline
  config/                # Configuração e labels (pt-BR)
  core/                  # BaseAgent, Logger, ModeManager
  database/              # Leitura de schemas (Postgres, MySQL, MSSQL)
  indexer/               # Scanner de repositório + sub-scanners
  orchestrator/          # Coordenação do pipeline
  output/                # Gerador de artefatos (Markdown + JSON)
  types/                 # Tipos TypeScript compartilhados

prompts/                 # Templates de prompt para LLM
docs/features/           # Saída do pipeline por funcionalidade
```

---

## Scripts Disponíveis

| Script | Comando | Descrição |
|---|---|---|
| Build | `npm run build` | Compila TypeScript → `dist/` |
| MCP Server | `npm run mcp` | Inicia o MCP Server (stdio) |
| CLI | `npm start` | Inicia a CLI |
| Gerar análise | `npm run generate <desc>` | Pipeline completo via CLI |
| Dev | `npm run dev` | Executa com ts-node |
| Lint | `npm run lint` | ESLint |
| Empacotar | `npm run dist` | Build + gera `ai-mcp.exe` |
| Clean | `npm run clean` | Remove `dist/` |

---

## Requisitos

- **Para desenvolvimento**: Node.js 20+, npm
- **Para distribuição (.exe)**: Nenhum — executável standalone
- **Para uso**: VS Code com GitHub Copilot ativado
- **Opcional**: Chave de API de LLM (OpenAI, Anthropic, etc.) para análises mais detalhadas

---

## Licença

MIT
