import { spawn } from 'child_process';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

class GitService {
  private async execGit(args: string[], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git failed: ${stderr || stdout}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn git: ${err.message}`));
      });
    });
  }

  async clone(url: string, targetPath: string): Promise<void> {
    // Ensure parent directory exists
    await mkdir(dirname(targetPath), { recursive: true });
    await this.execGit(['clone', url, targetPath]);
    console.log(`[Git] Cloned ${url} to ${targetPath}`);
  }

  async init(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
    await this.execGit(['init'], path);
    
    // Configure git user for commits
    await this.execGit(['config', 'user.email', 'exodus@localhost'], path);
    await this.execGit(['config', 'user.name', 'Exodus Control'], path);
    
    console.log(`[Git] Initialized empty repo at ${path}`);
  }

  async isRepo(path: string): Promise<boolean> {
    try {
      await this.execGit(['rev-parse', '--git-dir'], path);
      return true;
    } catch {
      return false;
    }
  }

  async pull(path: string): Promise<void> {
    await this.execGit(['pull'], path);
    console.log(`[Git] Pulled latest changes in ${path}`);
  }
}

export const gitService = new GitService();
