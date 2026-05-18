/**
 * @module svn-adapter
 */

import { spawn } from 'node:child_process';
import { FileWalker } from '/utils/file-walker';
import { dirname, join, toPosix } from '/utils/path';
import { SvnOperationContext } from '/types/operation';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { createLogger, getErrorMessage } from '/utils/logger';
import { SvnTransportAdapter } from '/adapters/transport-adapter';
import { EntryFilters } from '/types/config';

const SVN_EXECUTABLE = 'svn';
const STATUS_BATCH_SIZE = 50;

const logger = createLogger('SvnAdapter');

interface CommandResult {
  stdout: string;
  stderr: string;
}

export class SvnAdapter implements SvnTransportAdapter {
  #fileWalker: FileWalker;
  #config: SvnOperationContext;
  #pendingPaths = new Set<string>();

  /**
   * @constructor SvnAdapter
   * @param config SVN 操作上下文
   * @param fileWalker 文件遍历器
   */
  constructor(config: SvnOperationContext, fileWalker: FileWalker) {
    this.#config = config;
    this.#fileWalker = fileWalker;
  }

  async #runSvnCommand(args: string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn(SVN_EXECUTABLE, args, {
        cwd: this.#config.workspace,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.on('error', error => {
        reject(error);
      });

      child.stdout.on('data', chunk => {
        stdout += String(chunk);
      });

      child.stderr.on('data', chunk => {
        stderr += String(chunk);
      });

      child.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`SVN command failed: ${SVN_EXECUTABLE} ${args.join(' ')}\n${stderr || stdout}`));
        }
      });
    });
  }

  #assertSafePath(path: string): void {
    const normalized = toPosix(path).trim();

    if (!normalized || normalized === '.' || normalized === '/') {
      throw new Error(`路径不合法: ${path}`);
    }

    if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('//')) {
      throw new Error(`不允许绝对路径: ${path}`);
    }

    const segments = normalized.split('/').filter(Boolean);

    if (segments[0] === '..' || segments.includes('..')) {
      throw new Error(`路径疑似越界: ${path}`);
    }
  }

  async #findUnknownPaths(paths: string[]): Promise<string[]> {
    const unknownPaths: string[] = [];

    for (let i = 0; i < paths.length; i += STATUS_BATCH_SIZE) {
      const batch = paths.slice(i, i + STATUS_BATCH_SIZE);
      const output = await this.#runSvnCommand(['status', ...batch]);

      const lines = output.stdout.split(/\r?\n/);

      for (const line of lines) {
        if (line.startsWith('?')) {
          const filePath = line.slice(1).trim();

          if (filePath) {
            unknownPaths.push(filePath);
          }
        }
      }
    }

    return unknownPaths;
  }

  async #removePath(path: string, isDirectory: boolean): Promise<void> {
    this.#assertSafePath(path);

    const fullPath = join(this.#config.workspace, path);

    try {
      await this.#runSvnCommand(['delete', '--force', path]);

      this.#pendingPaths.add(path);
    } catch (error) {
      const message = getErrorMessage(error);

      logger.debug(`SVN 删除失败，使用文件系统删除`, { path, error: message });

      await rm(fullPath, { recursive: isDirectory, force: true });

      this.#pendingPaths.add(path);
    }
  }

  async dispose(): Promise<void> {
    this.#pendingPaths.clear();
  }

  async uploadFile(source: string, target: string): Promise<void> {
    this.#assertSafePath(target);

    const fullTargetPath = join(this.#config.workspace, target);
    const targetDir = dirname(fullTargetPath);

    if (targetDir) {
      await mkdir(targetDir, { recursive: true });
    }

    await copyFile(source, fullTargetPath);

    this.#pendingPaths.add(target);
  }

  async uploadDirectory(source: string, target: string, filters?: EntryFilters): Promise<void> {
    this.#assertSafePath(target);

    const walker = this.#fileWalker.walk(source, { filters });

    for await (const entry of walker) {
      if (entry.isFile) {
        await this.uploadFile(entry.fullPath, join(target, entry.relativePath));
      }
    }
  }

  async deleteFile(path: string): Promise<void> {
    await this.#removePath(path, false);
  }

  async deleteDirectory(path: string): Promise<void> {
    await this.#removePath(path, true);
  }

  async #add(): Promise<void> {
    if (this.#pendingPaths.size === 0) {
      return;
    }

    const paths = [...this.#pendingPaths];
    const unknownPaths = await this.#findUnknownPaths(paths);

    if (unknownPaths.length > 0) {
      await this.#runSvnCommand(['add', '--parents', ...unknownPaths]);
    }
  }

  async commit(message?: string): Promise<void> {
    if (this.#pendingPaths.size === 0) {
      return;
    }

    await this.#add();

    const paths = [...this.#pendingPaths];
    const statusResult = await this.#runSvnCommand(['status', ...paths]);

    if (!statusResult.stdout.trim()) {
      return;
    }

    const commitMessage = message || this.#config.commitMessage || 'deploy update';

    await this.#runSvnCommand(['commit', '-m', commitMessage, ...paths]);

    this.#pendingPaths.clear();
  }
}
