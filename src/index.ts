#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { loadConfig } from './config';
import { Logger } from './core';
import { DatabaseReader, DatabaseProvider } from './database';
import { RepositoryIndexer } from './indexer';
import { Orchestrator } from './orchestrator';
import { OutputGenerator } from './output';

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8'),
);

const BANNER = `
╔══════════════════════════════════════════╗
║   AI Developer Analytics CLI  v${pkg.version}    ║
║   Multi-agent software architect         ║
╚══════════════════════════════════════════╝
`;

const program = new Command();

program
  .name('ai-cli')
  .description('AI multi-agent software architect CLI')
  .version(pkg.version, '-V, --version', 'Display the current version')
  .option('-c, --config <path>', 'Path to config file')
  .option('-o, --output <dir>', 'Base output directory', '.')
  .option('-p, --path <path>', 'Path to the project repository', '.')
  .option('-v, --verbose', 'Enable verbose (debug) logging')
  .option('--dry-run', 'Show what would be executed without running agents')
  .option('-m, --mode <mode>', 'Execution mode: llm-online | llm-offline | repository-only');

// Apply global options before every command
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  if (opts.verbose) {
    Logger.level = 'debug';
  }
  // Print banner on every non-version action
  process.stderr.write(BANNER);
});

// ── generate ─────────────────────────────────────────────────────────────────
program
  .command('generate')
  .description('Run the full analysis pipeline and generate the output package')
  .argument('<description>', 'Feature description or requirement text')
  .option('--prototype', 'Generate a prototype scaffold', false)
  .option('--attach <paths...>', 'Attach extra files or directories for context')
  .option('--specialists', 'Enable language-specific specialist agents', false)
  .option('--flowcharts', 'Enable Mermaid flowchart generation', false)
  .option('--executive', 'Enable technical + executive documentation variants', false)
  .action(async (description: string, cmdOpts: Record<string, unknown>) => {
    const globalOpts = program.opts();
    try {
      const config = loadConfig(globalOpts.config as string | undefined);
      const baseDir = globalOpts.output as string;
      const projectPath = globalOpts.path as string;

      if (globalOpts.dryRun) {
        Logger.info('[dry-run] Would run full pipeline for: "' + description + '"');
        Logger.info(`[dry-run] Project: ${projectPath}, Output: ${baseDir}`);
        return;
      }

      Logger.info(`Generating feature package for: "${description}"`);

      const orchestrator = new Orchestrator();
      const result = await orchestrator.run({
        projectPath,
        config,
        requirements: description,
        generatePrototype: Boolean(cmdOpts.prototype),
        mode: globalOpts.mode as string | undefined,
        attachPaths: cmdOpts.attach as string[] | undefined,
        enableSpecialists: Boolean(cmdOpts.specialists),
        enableFlowcharts: Boolean(cmdOpts.flowcharts),
        enableExecutiveDocs: Boolean(cmdOpts.executive),
      });

      const outputGen = new OutputGenerator();
      const outputDir = outputGen.write(result, baseDir);

      Logger.info(`Feature package generated successfully in ${outputDir}`);
    } catch (err) {
      Logger.error(`Generation failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ── analyze ──────────────────────────────────────────────────────────────────
program
  .command('analyze')
  .description('Analyze a project directory (alias of generate without a feature description)')
  .option('-r, --requirements <text>', 'Requirement or feature description')
  .option('--prototype', 'Generate a prototype scaffold from requirements', false)
  .option('--attach <paths...>', 'Attach extra files or directories for context')
  .option('--specialists', 'Enable language-specific specialist agents', false)
  .option('--flowcharts', 'Enable Mermaid flowchart generation', false)
  .option('--executive', 'Enable technical + executive documentation variants', false)
  .action(async (cmdOpts: Record<string, unknown>) => {
    const globalOpts = program.opts();
    try {
      const config = loadConfig(globalOpts.config as string | undefined);
      const baseDir = globalOpts.output as string;
      const projectPath = globalOpts.path as string;

      if (globalOpts.dryRun) {
        Logger.info('[dry-run] Would analyze project at: ' + projectPath);
        return;
      }

      const orchestrator = new Orchestrator();
      const result = await orchestrator.run({
        projectPath,
        config,
        requirements: cmdOpts.requirements as string | undefined,
        generatePrototype: Boolean(cmdOpts.prototype),
        mode: globalOpts.mode as string | undefined,
        attachPaths: cmdOpts.attach as string[] | undefined,
        enableSpecialists: Boolean(cmdOpts.specialists),
        enableFlowcharts: Boolean(cmdOpts.flowcharts),
        enableExecutiveDocs: Boolean(cmdOpts.executive),
      });

      const outputGen = new OutputGenerator();
      const outputDir = outputGen.write(result, baseDir);

      Logger.info('Analysis complete. Results written to ' + outputDir);
    } catch (err) {
      Logger.error(`Analysis failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ── index ────────────────────────────────────────────────────────────────────
program
  .command('index')
  .description('Index a repository and generate context JSON files')
  .action(async () => {
    const globalOpts = program.opts();
    const projectPath = globalOpts.path as string;
    try {
      if (globalOpts.dryRun) {
        Logger.info('[dry-run] Would index repository at: ' + projectPath);
        return;
      }

      const indexer = new RepositoryIndexer();
      const ctx = indexer.index(projectPath);
      Logger.info(
        `Indexed ${ctx.meta.totalFiles} files — context saved to ${projectPath}/context/`,
      );
    } catch (err) {
      Logger.error(`Indexing failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ── db-read ──────────────────────────────────────────────────────────────────
program
  .command('db-read')
  .description('Read database schema and save to context/database-summary.json')
  .argument('<connection-string>', 'Database connection string')
  .option('--provider <provider>', 'Database provider: postgres | mysql | mssql')
  .option('--schema <schema>', 'Schema to introspect (default: auto-detected)')
  .action(async (connectionString: string, cmdOpts: Record<string, unknown>) => {
    const globalOpts = program.opts();
    const projectPath = globalOpts.path as string;
    try {
      if (globalOpts.dryRun) {
        Logger.info('[dry-run] Would read database schema');
        return;
      }

      const reader = new DatabaseReader();
      const summary = await reader.read({
        connectionString,
        provider: cmdOpts.provider as DatabaseProvider | undefined,
        schema: cmdOpts.schema as string | undefined,
        projectPath,
      });
      Logger.info(
        `Database read complete: ${summary.meta.tableCount} tables, ` +
          `${summary.meta.viewCount} views, ${summary.meta.storedProcedureCount} procedures`,
      );
    } catch (err) {
      Logger.error(`Database read failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ── estimate ─────────────────────────────────────────────────────────────────
program
  .command('estimate')
  .description('Run the pipeline and display the estimation summary')
  .argument('<description>', 'Feature description or requirement text')
  .action(async (description: string) => {
    const globalOpts = program.opts();
    try {
      const config = loadConfig(globalOpts.config as string | undefined);
      const projectPath = globalOpts.path as string;

      if (globalOpts.dryRun) {
        Logger.info('[dry-run] Would estimate effort for: "' + description + '"');
        return;
      }

      Logger.info(`Estimating effort for: "${description}"`);

      const orchestrator = new Orchestrator();
      const result = await orchestrator.run({
        projectPath,
        config,
        requirements: description,
        mode: globalOpts.mode as string | undefined,
      });

      const estimation = result.context.estimation;
      if (estimation) {
        Logger.info(`Total estimated hours: ${estimation.totalHours}`);
        Logger.info(`Confidence: ${estimation.confidence}`);
        for (const item of estimation.breakdown) {
          Logger.info(`  ${item.task}: ${item.hours}h (${item.complexity})`);
        }
      } else {
        Logger.warn('Estimation step produced no result');
      }
    } catch (err) {
      Logger.error(`Estimation failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program.parse();
