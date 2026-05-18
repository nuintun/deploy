/**
 * @module deploy-executor
 */

import {
  DeployPlan,
  ExecutionContext,
  ExecutionResult,
  FtpOperationContext,
  Operation,
  OperationContext,
  OperationResult,
  OperationType,
  SvnOperationContext
} from '/types/operation';
import { FileWalker } from '/utils/file-walker';
import { FtpAdapter } from '/adapters/ftp-adapter';
import { SvnAdapter } from '/adapters/svn-adapter';
import { captureError, createLogger, getErrorMessage } from '/utils/logger';
import { FtpTransportAdapter, SvnTransportAdapter, TransportAdapter } from '/adapters/transport-adapter';

const logger = createLogger('DeployExecutor');

function assertNever(value: never): never {
  throw new Error(`未知操作类型: ${JSON.stringify(value)}`);
}

function createSuccessResult(operationId: string, duration?: number): OperationResult {
  return { success: true, operationId, duration };
}

function createErrorResult(operationId: string, error: string, duration?: number): OperationResult {
  return { success: false, operationId, error, duration };
}

export class DeployExecutor {
  #adapterFactories = new Map<string, () => TransportAdapter>();

  async #resolveAdapter(adapterKey: string, activeAdapters: Map<string, TransportAdapter>): Promise<TransportAdapter> {
    const existing = activeAdapters.get(adapterKey);

    if (existing) {
      return existing;
    }

    const factory = this.#adapterFactories.get(adapterKey);

    if (!factory) {
      throw new Error(`未注册的适配器: ${adapterKey}`);
    }

    logger.debug(`创建并连接适配器: ${adapterKey}`);

    const adapter = factory();

    if (isFtpAdapter(adapter)) {
      await adapter.connect();
    }

    activeAdapters.set(adapterKey, adapter);

    logger.info(`适配器已连接: ${adapterKey}`);

    return adapter;
  }

  async #executeOperation(
    operation: Operation,
    context: ExecutionContext,
    activeAdapters: Map<string, TransportAdapter>
  ): Promise<void> {
    if (!operation.context) {
      logger.warn(`操作 ${operation.id} 缺少适配器上下文，跳过执行`);

      return;
    }

    const adapter = await this.#resolveAdapter(operation.context.adapterKey, activeAdapters);

    logger.debug(`执行操作: ${operation.type}`, {
      operationId: operation.id,
      description: operation.description
    });

    switch (operation.type) {
      case OperationType.UPLOAD_FILE:
        await adapter.uploadFile(operation.source, operation.target);
        break;
      case OperationType.UPLOAD_DIRECTORY:
        await adapter.uploadDirectory(operation.source, operation.target, operation.filters);
        break;
      case OperationType.DELETE_FILE:
        await adapter.deleteFile(operation.target);
        break;
      case OperationType.DELETE_DIRECTORY:
        await adapter.deleteDirectory(operation.target);
        break;
      case OperationType.SVN_DELETE:
        if (operation.isDirectory) {
          await adapter.deleteDirectory(operation.target);
        } else {
          await adapter.deleteFile(operation.target);
        }
        break;
      case OperationType.SVN_COMMIT:
        if (isSvnAdapter(adapter)) {
          await adapter.commit(context.message ?? operation.context?.commitMessage);
        }
        break;
      default:
        assertNever(operation);
    }

    logger.debug(`操作执行完成: ${operation.id}`);
  }

  async #cleanupAdapters(activeAdapters: Map<string, TransportAdapter>): Promise<void> {
    logger.debug(`开始清理 ${activeAdapters.size} 个适配器`);

    for (const [adapterKey, adapter] of activeAdapters) {
      try {
        logger.debug(`释放适配器资源: ${adapterKey}`);

        await adapter.dispose();

        logger.debug(`适配器资源已释放: ${adapterKey}`);
      } catch (error) {
        logger.warn('适配器清理失败', captureError(error));
      }
    }

    logger.debug('适配器清理完成');
  }

  registerAdapter(name: string, factory: () => TransportAdapter): void {
    if (this.#adapterFactories.has(name)) {
      logger.warn(`适配器 "${name}" 已存在，将被覆盖`);
    }

    this.#adapterFactories.set(name, factory);

    logger.info(`适配器注册成功: ${name}`);
  }

  unregisterAdapter(name: string): boolean {
    const removed = this.#adapterFactories.delete(name);

    if (removed) {
      logger.info(`适配器已注销: ${name}`);
    }

    return removed;
  }

  hasAdapter(name: string): boolean {
    return this.#adapterFactories.has(name);
  }

  getRegisteredAdapters(): string[] {
    return Array.from(this.#adapterFactories.keys());
  }

  async execute(plan: DeployPlan, context: ExecutionContext): Promise<ExecutionResult> {
    logger.info(`开始执行部署计划: ${plan.name}`);
    logger.debug('执行上下文', { dryRun: context.dryRun, baseDir: context.baseDir });

    const startTime = Date.now();

    if (context.dryRun) {
      return this.#executeDryRun(plan, startTime);
    }

    return this.#executeReal(plan, context, startTime);
  }

  #executeDryRun(plan: DeployPlan, startTime: number): ExecutionResult {
    logger.info(`预览部署计划: ${plan.name}`);

    const operationResults: OperationResult[] = plan.operations.map(operation => {
      logger.info(`[PREVIEW] ${operation.description}`);

      return createSuccessResult(operation.id);
    });

    logger.info(`预览结束，共 ${plan.operations.length} 个操作`);

    return {
      success: true,
      operationResults,
      totalDuration: Date.now() - startTime
    };
  }

  async #executeReal(plan: DeployPlan, context: ExecutionContext, startTime: number): Promise<ExecutionResult> {
    const activeAdapters = new Map<string, TransportAdapter>();
    const operationResults: OperationResult[] = [];

    try {
      logger.debug(`开始执行 ${plan.operations.length} 个操作`);

      for (const operation of plan.operations) {
        const opStartTime = Date.now();

        try {
          logger.info(`执行: ${operation.description}`);

          await this.#executeOperation(operation, context, activeAdapters);

          operationResults.push(createSuccessResult(operation.id, Date.now() - opStartTime));
        } catch (error) {
          const message = getErrorMessage(error);

          logger.error('操作失败', {
            ...captureError(error),
            operationId: operation.id,
            description: operation.description
          });

          operationResults.push(createErrorResult(operation.id, message, Date.now() - opStartTime));
          break;
        }
      }

      const totalDuration = Date.now() - startTime;
      const successCount = operationResults.filter(result => result.success).length;
      const errorCount = operationResults.length - successCount;
      const allSuccess = errorCount === 0;

      if (allSuccess) {
        logger.info(`部署计划 "${plan.name}" 执行成功`, {
          success: successCount,
          total: plan.operations.length,
          duration: `${totalDuration}ms`
        });
      } else {
        const skippedCount = plan.operations.length - operationResults.length;

        logger.warn(`部署计划 "${plan.name}" 执行中止`, {
          failed: errorCount,
          success: successCount,
          skipped: skippedCount,
          duration: `${totalDuration}ms`
        });
      }

      return {
        totalDuration,
        operationResults,
        success: allSuccess
      };
    } finally {
      await this.#cleanupAdapters(activeAdapters);
    }
  }
}

function isFtpContext(ctx: OperationContext): ctx is FtpOperationContext {
  return ctx.adapter === 'ftp';
}

function isSvnContext(ctx: OperationContext): ctx is SvnOperationContext {
  return ctx.adapter === 'svn';
}

function isFtpAdapter(adapter: TransportAdapter): adapter is FtpTransportAdapter {
  return 'connect' in adapter;
}

function isSvnAdapter(adapter: TransportAdapter): adapter is SvnTransportAdapter {
  return 'add' in adapter && 'commit' in adapter;
}

/**
 * @function createExecutor
 * @description 根据部署计划创建并配置执行器，自动注册所需适配器
 * @param plan 部署计划
 * @returns 配置好的 DeployExecutor 实例
 */
export function createExecutor(plan: DeployPlan): DeployExecutor {
  const fileWalker = new FileWalker();
  const executor = new DeployExecutor();
  const registeredAdapters = new Set<string>();

  for (const operation of plan.operations) {
    if (!operation.context) {
      continue;
    }

    const adapterKey = operation.context.adapterKey;

    if (registeredAdapters.has(adapterKey)) {
      continue;
    }

    const context = operation.context;

    if (isFtpContext(context)) {
      executor.registerAdapter(adapterKey, () => new FtpAdapter(context, fileWalker));
    } else if (isSvnContext(context)) {
      executor.registerAdapter(adapterKey, () => new SvnAdapter(context, fileWalker));
    }

    registeredAdapters.add(adapterKey);
  }

  logger.debug(`已注册适配器`, { adapters: Array.from(registeredAdapters) });

  return executor;
}
