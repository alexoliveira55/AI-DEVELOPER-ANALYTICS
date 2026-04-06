import { execSync } from 'child_process';
import { BaseAgent } from '../core';
import { AgentRole, GitAnalysis, GitCommitInfo, SessionContext } from '../types';

/** Analyzes the local Git repository for history, authors, hot files and branches. */
export class GitAnalyzerAgent extends BaseAgent<string, GitAnalysis> {
  readonly role = AgentRole.GitAnalyzer;
  readonly name = 'Git Analyzer';

  protected async run(projectPath: string, _context: SessionContext): Promise<GitAnalysis> {
    const exec = (cmd: string) => {
      try {
        return execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 30000 }).trim();
      } catch {
        return '';
      }
    };

    // Verify this is a git repo
    const gitCheck = exec('git rev-parse --is-inside-work-tree');
    if (gitCheck !== 'true') {
      this.logger.warn('Not a git repository');
      return {
        recentCommits: [],
        activeAuthors: [],
        hotFiles: [],
        branchInfo: { current: 'unknown', branches: [] },
        lastActivity: '',
      };
    }

    const recentCommits = this.parseCommits(exec('git log --format="%H|%an|%aI|%s" -50'));
    const activeAuthors = this.parseAuthors(exec('git log --since="90 days ago" --format="%an"'));
    const hotFiles = this.parseHotFiles(exec('git log --since="90 days ago" --name-only --format=""'));

    let branchInfo = { current: 'unknown', branches: [] as string[] };
    const current = exec('git branch --show-current');
    if (current) {
      const all = exec('git branch -a')
        .split('\n')
        .map((b) => b.trim().replace(/^\* /, ''))
        .filter(Boolean);
      branchInfo = { current, branches: all };
    }

    const lastActivity = exec('git log -1 --format="%aI"');

    return { recentCommits, activeAuthors, hotFiles, branchInfo, lastActivity };
  }

  private parseCommits(raw: string): GitCommitInfo[] {
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map((line) => {
      const [hash, author, date, ...msgParts] = line.split('|');
      return { hash, author, date, message: msgParts.join('|'), filesChanged: 0 };
    });
  }

  private parseAuthors(raw: string): string[] {
    if (!raw) return [];
    const counts = new Map<string, number>();
    raw.split('\n').filter(Boolean).forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }

  private parseHotFiles(raw: string): string[] {
    if (!raw) return [];
    const counts = new Map<string, number>();
    raw.split('\n').filter(Boolean).forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([f]) => f);
  }
}
