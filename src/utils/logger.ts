/**
 * @module logger
 */

/**
 * @interface Logger
 * @description 轻量级日志记录器接口
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * @const LogLevel
 * @description 日志级别常量
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
} as const;

type LogLevel = typeof LogLevel;

export type LogLevelType = LogLevel[keyof LogLevel];

const LOG_LEVEL_MAP: Record<string, LogLevelType> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR
};

const COLOR_CODES: Record<string, string> = {
  DEBUG: '\x1b[36m',
  INFO: '\x1b[32m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  RESET: '\x1b[0m'
};

const LEVEL_LABELS: Record<number, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR'
};

const enableColor = !process.env.DEPLOY_NO_COLOR && process.stdout.isTTY;

const currentLogLevel: LogLevelType = LOG_LEVEL_MAP[process.env.DEPLOY_LOG_LEVEL?.toLowerCase().trim() ?? ''] ?? LogLevel.INFO;

function formatTimestamp(): string {
  return new Date().toLocaleTimeString(undefined, { hour12: false });
}

function formatValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '[Object]';
  }
}

function formatContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return '';

  try {
    const pairs: string[] = [];

    for (const [key, value] of Object.entries(context)) {
      if (value !== null && typeof value === 'object' && !(value instanceof Error)) {
        try {
          const nested = JSON.parse(JSON.stringify(value));

          for (const [nestedKey, nestedValue] of Object.entries(nested)) {
            pairs.push(`${key}.${nestedKey}=${formatValue(nestedValue)}`);
          }
        } catch {
          pairs.push(`${key}=${formatValue(value)}`);
        }
      } else {
        pairs.push(`${key}=${formatValue(value)}`);
      }
    }

    return ` (${pairs.join(' ')})`;
  } catch {
    return ' [context serialization failed]';
  }
}

/**
 * @function captureError
 * @description 将错误转换为日志 context 字段
 * @param error - 错误对象
 * @returns 包含 error 和 stack 字段的上下文对象
 */
export function captureError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { error: error.message, stack: error.stack };
  }

  return { error: String(error) };
}

/**
 * @function getErrorMessage
 * @description 从任意错误对象中提取消息字符串
 * @param error - 错误对象
 * @returns 错误消息字符串
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @function createLogger
 * @description 创建日志记录器实例
 * @param moduleName - 模块名称
 * @returns Logger 实例
 */
export function createLogger(moduleName?: string): Logger {
  const modulePrefix = moduleName ? `[${moduleName}] ` : '';

  function log(levelValue: LogLevelType, message: string, context?: Record<string, unknown>): void {
    if (levelValue >= currentLogLevel) {
      const timestamp = formatTimestamp();
      const contextMessage = formatContext(context);
      const label = LEVEL_LABELS[levelValue] ?? 'UNKNOWN';
      const colorEnd = enableColor ? COLOR_CODES.RESET : '';
      const colorStart = enableColor ? (COLOR_CODES[label] ?? '') : '';
      const output = `${colorStart}[${label}]${colorEnd} [${timestamp}] ${modulePrefix}${message}${contextMessage}`;

      if (levelValue >= LogLevel.WARN) {
        console.error(output);
      } else {
        console.log(output);
      }
    }
  }

  return {
    debug(message: string, context?: Record<string, unknown>): void {
      log(LogLevel.DEBUG, message, context);
    },

    info(message: string, context?: Record<string, unknown>): void {
      log(LogLevel.INFO, message, context);
    },

    warn(message: string, context?: Record<string, unknown>): void {
      log(LogLevel.WARN, message, context);
    },

    error(message: string, context?: Record<string, unknown>): void {
      log(LogLevel.ERROR, message, context);
    }
  };
}
