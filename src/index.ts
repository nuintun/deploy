/**
 * @module index
 */

import { resolve } from '/utils/path';
import { ExecutionResult } from '/types/operation';
import { DeployPlanner } from '/planner/deploy-planner';
import { captureError, createLogger } from '/utils/logger';
import { createExecutor } from '/executor/deploy-executor';
import { DeployConfig, DeployOptions, DeployTask } from '/types/config';

export type { DeployTask, DeployConfig, DeployOptions };
export type { ExecutionResult, OperationResult } from '/types/operation';
export type { DeployEntry, EntryFilters, FtpConfig, SvnConfig } from '/types/config';

const logger = createLogger('Deploy');

export function defineConfig<T extends DeployConfig>(config: T): T {
  return config;
}

export async function deploy(config: DeployConfig, options: DeployOptions = {}): Promise<ExecutionResult[]> {
  const startTime = Date.now();
  const results: ExecutionResult[] = [];
  const tasks = Array.isArray(config) ? config : [config];
  const baseDir = resolve(options.baseDir ?? process.cwd());

  DeployPlanner.resetCounters();

  logger.info(`=== 开始部署流程 ===`, { baseDir, taskCount: tasks.length });
  logger.debug(`部署选项`, { dryRun: options.dryRun, message: !!options.message });

  try {
    const planner = new DeployPlanner();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      logger.info(`--- 处理任务 ${i + 1}/${tasks.length}: ${task.name || '未命名任务'} ---`);

      const plan = await planner.plan(baseDir, task);

      const executor = createExecutor(plan);

      const result = await executor.execute(plan, {
        baseDir,
        message: options.message,
        dryRun: options.dryRun ?? false
      });

      results.push(result);
    }

    logger.info(`=== 部署流程结束 ===`, { duration: `${Date.now() - startTime}ms` });

    return results;
  } catch (error) {
    logger.error(`部署流程失败`, { ...captureError(error), duration: `${Date.now() - startTime}ms` });

    throw error;
  }
}
