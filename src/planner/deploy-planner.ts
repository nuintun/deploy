/**
 * @module deploy-planner
 */

import { lstat } from 'node:fs/promises';
import { globToRegex } from '/utils/glob';
import { join, resolve, toPosix } from '/utils/path';
import { captureError, createLogger, getErrorMessage } from '/utils/logger';
import { DeployTask, DeployEntry, EntryFilters, FtpConfig, SvnConfig } from '/types/config';
import { DeployPlan, FtpOperationContext, Operation, OperationType, SvnOperationContext } from '/types/operation';

let taskCounter = 0;
let operationCounter = 0;

const logger = createLogger('DeployPlanner');

function generateOperationId(prefix: string): string {
  return `${prefix}-${operationCounter++}`;
}

function buildFilters(entry: DeployEntry): EntryFilters | undefined {
  const excludePatterns = entry.exclude ?? [];
  const includePatterns = entry.include ?? [];

  if (excludePatterns.length === 0 && includePatterns.length === 0) {
    return undefined;
  }

  const excludePathRegexps: RegExp[] = [];
  const includePathRegexps: RegExp[] = [];
  const excludeBasenameRegexps: RegExp[] = [];
  const includeBasenameRegexps: RegExp[] = [];

  for (const pattern of excludePatterns) {
    (toPosix(pattern).includes('/') ? excludePathRegexps : excludeBasenameRegexps).push(globToRegex(pattern));
  }

  for (const pattern of includePatterns) {
    (toPosix(pattern).includes('/') ? includePathRegexps : includeBasenameRegexps).push(globToRegex(pattern));
  }

  return {
    excludePathRegexps,
    includePathRegexps,
    excludeBasenameRegexps,
    includeBasenameRegexps
  };
}

function stripGlobBase(path: string): string {
  const normalized = toPosix(path);

  if (!normalized.includes('*') && !normalized.includes('?')) {
    return normalized;
  }

  const baseSegments: string[] = [];
  const segments = normalized.split('/');

  for (const segment of segments) {
    if (segment.includes('*') || segment.includes('?')) {
      break;
    }

    baseSegments.push(segment);
  }

  return baseSegments.join('/') || '.';
}

export class DeployPlanner {
  static resetCounters(): void {
    taskCounter = 0;
    operationCounter = 0;
  }

  async #processEntry(
    baseDir: string,
    entry: DeployEntry,
    ftpConfig: FtpConfig | undefined,
    svnConfig: SvnConfig | undefined
  ): Promise<Operation[]> {
    const operations: Operation[] = [];
    const target = stripGlobBase(entry.target);
    const source = resolve(baseDir, stripGlobBase(entry.source));

    logger.debug('处理条目', { source, target });

    if (!ftpConfig && !svnConfig) {
      logger.warn(`跳过条目 ${entry.source}: 未配置 FTP 或 SVN`);

      return operations;
    }

    try {
      const stat = await lstat(source);
      const isDirectory = stat.isDirectory();
      const filters = buildFilters(entry);

      if (ftpConfig) {
        const remoteTarget = join(ftpConfig.workspace, target);
        const adapterKey = `ftp-${ftpConfig.host}:${ftpConfig.port ?? 21}`;
        const context: FtpOperationContext = {
          adapter: 'ftp',
          adapterKey,
          host: ftpConfig.host,
          port: ftpConfig.port,
          user: ftpConfig.user,
          secure: ftpConfig.secure,
          timeout: ftpConfig.timeout,
          password: ftpConfig.password
        };

        if (ftpConfig.cleanBeforeDeploy ?? false) {
          operations.push({
            context,
            target: remoteTarget,
            id: generateOperationId('ftp-delete'),
            description: `FTP 删除旧目标: ${remoteTarget}`,
            type: isDirectory ? OperationType.DELETE_DIRECTORY : OperationType.DELETE_FILE
          } satisfies Operation);
        }

        operations.push({
          source,
          filters,
          context,
          target: remoteTarget,
          id: generateOperationId('ftp-upload'),
          type: isDirectory ? OperationType.UPLOAD_DIRECTORY : OperationType.UPLOAD_FILE,
          description: isDirectory ? `FTP 上传目录: ${source} -> ${remoteTarget}` : `FTP 上传文件: ${source} -> ${remoteTarget}`
        } satisfies Operation);

        logger.debug(`FTP 操作已规划: ${source} -> ${remoteTarget}`);
      }

      if (svnConfig) {
        const adapterKey = `svn-${svnConfig.workspace}`;
        const context: SvnOperationContext = {
          adapter: 'svn',
          adapterKey,
          workspace: svnConfig.workspace,
          commitMessage: svnConfig.commitMessage,
          cleanBeforeDeploy: svnConfig.cleanBeforeDeploy
        };

        if (svnConfig.cleanBeforeDeploy ?? false) {
          operations.push({
            target,
            context,
            type: isDirectory ? OperationType.DELETE_DIRECTORY : OperationType.DELETE_FILE,
            id: generateOperationId('svn-delete'),
            description: `SVN 删除旧目标: ${target}`
          } satisfies Operation);
        }

        operations.push({
          target,
          source,
          filters,
          context,
          id: generateOperationId('svn-upload'),
          description: isDirectory
            ? `复制目录到 SVN 工作副本: ${source} -> ${target}`
            : `复制文件到 SVN 工作副本: ${source} -> ${target}`,
          type: isDirectory ? OperationType.UPLOAD_DIRECTORY : OperationType.UPLOAD_FILE
        } satisfies Operation);

        logger.debug(`SVN 操作已规划: ${source} -> ${target}`);
      }
    } catch (error) {
      const message = getErrorMessage(error);

      logger.error(`处理条目失败: ${entry.source}`, captureError(error));

      throw new Error(`规划条目 "${entry.source}" 时出错: ${message}`);
    }

    return operations;
  }

  async plan(baseDir: string, task: DeployTask): Promise<DeployPlan> {
    logger.info(`开始规划部署任务: ${task.name || '未命名任务'}`);
    logger.debug('任务配置', {
      ftp: !!task.ftp,
      svn: !!task.svn,
      entries: task.entries.length
    });

    taskCounter++;

    const operations: Operation[] = [];

    for (const entry of task.entries) {
      const entryOperations = await this.#processEntry(baseDir, entry, task.ftp, task.svn);

      operations.push(...entryOperations);
    }

    if (task.svn) {
      operations.push({
        type: OperationType.SVN_COMMIT,
        id: generateOperationId('svn-commit'),
        description: `提交 SVN: ${task.svn.workspace}`,
        context: {
          adapter: 'svn',
          workspace: task.svn.workspace,
          commitMessage: task.svn.commitMessage,
          adapterKey: `svn-${task.svn.workspace}`,
          cleanBeforeDeploy: task.svn.cleanBeforeDeploy
        }
      } satisfies Operation);
    }

    const planName = task.name || `任务-${taskCounter}`;

    logger.info(`部署任务 "${planName}" 规划完成，共 ${operations.length} 个操作`);

    return {
      operations,
      name: planName
    };
  }
}
