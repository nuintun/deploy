/**
 * @module cli
 */

import { deploy } from './index';
import { resolve } from '/utils/path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { access } from 'node:fs/promises';
import { DeployConfig } from '/types/config';
import { captureError, createLogger } from '/utils/logger';

interface Args {
  help: boolean;
  dryRun: boolean;
  version: boolean;
  configPath: string;
  messageOverride?: string;
}

const logger = createLogger('CLI');

async function readVersion(): Promise<string> {
  const packageJsonPath = import.meta.resolve('../package.json');

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const { version } = JSON.parse(content);

    return version || 'unknown';
  } catch {
    return 'unknown';
  }
}

const HELP_TEMPLATE = `
deploy

用法:
  deploy
  deploy ./deploy.config.ts
  deploy --config ./deploy.config.ts
  deploy --config ./deploy.config.ts --dry-run
  deploy --config ./deploy.config.ts --message "提交说明"

选项:
  -h, --help       显示帮助信息
  -v, --version    显示版本号
  -c, --config     指定配置文件路径
  -m, --message    指定提交说明
  -n, --dry-run    预览模式，不实际执行

配置说明:
  1. 单任务: export default defineConfig({ name, ftp?, svn?, entries })
  2. 多任务: export default defineConfig([{ ... }, { ... }])
  3. ftp/svn 可任选其一或同时启用
  4. entries[].source 为本地源文件或目录
  5. entries[].target 为 FTP 基础目录下的相对路径，同时也是 SVN 工作副本下的相对路径
  6. ftp.cleanBeforeDeploy / svn.cleanBeforeDeploy 可选，表示部署前先清理目标旧文件
  7. entries[].include / entries[].exclude 可选，支持简单 glob（*, **, ?）过滤目录内文件

环境变量:
  DEPLOY_LOG_LEVEL - 日志级别: debug, info, warn, error (默认: info)
  DEPLOY_NO_COLOR - 设置为任意值禁用彩色输出
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    process.stdout.write(HELP_TEMPLATE);
    return;
  }

  if (options.version) {
    const version = await readVersion();

    process.stdout.write(`deploy v${version}\n`);
    return;
  }

  if (!(await exists(options.configPath))) {
    throw new Error(`配置文件不存在: ${options.configPath}`);
  }

  const { default: config } = await import(pathToFileURL(options.configPath).href);

  const results = await deploy(config as DeployConfig, {
    dryRun: options.dryRun,
    message: options.messageOverride
  });

  const hasFailure = results.some(result => !result.success);

  if (hasFailure) {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): Args {
  const options: Args = {
    help: false,
    dryRun: false,
    version: false,
    configPath: resolve(process.cwd(), 'deploy.config.ts')
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }

    if (arg === '-v' || arg === '--version') {
      options.version = true;
      continue;
    }

    if (arg === '-c' || arg === '--config') {
      const nextArgValue = argv[i + 1];

      if (!nextArgValue) {
        throw new Error('`--config` 缺少配置文件路径');
      }

      options.configPath = resolve(process.cwd(), nextArgValue);

      i++;
      continue;
    }

    if (arg === '-m' || arg === '--message') {
      const nextArgValue = argv[i + 1];

      if (!nextArgValue) {
        throw new Error('`--message` 缺少提交说明内容');
      }

      options.messageOverride = nextArgValue;

      i++;
      continue;
    }

    if (arg === '-n' || arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (!arg.startsWith('-')) {
      options.configPath = resolve(process.cwd(), arg);
      continue;
    }

    throw new Error(`不支持的参数: ${arg}`);
  }

  return options;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
}

main().catch(error => {
  logger.error(`CLI 执行失败`, captureError(error));

  process.exitCode = 1;
});
