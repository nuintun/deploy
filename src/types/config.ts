/**
 * @module config
 */

/**
 * @interface FtpConfig
 * @description FTP 配置
 */
export interface FtpConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  secure?: boolean;
  workspace: string;
  timeout?: number;
  cleanBeforeDeploy?: boolean;
}

/**
 * @interface SvnConfig
 * @description SVN 配置
 */
export interface SvnConfig {
  workspace: string;
  commitMessage?: string;
  cleanBeforeDeploy?: boolean;
}

/**
 * @interface DeployEntry
 * @description 部署条目
 */
export interface DeployEntry {
  source: string;
  target: string;
  exclude?: string[];
  include?: string[];
}

/**
 * @interface DeployTask
 * @description 部署任务
 */
export interface DeployTask {
  name?: string;
  ftp?: FtpConfig;
  svn?: SvnConfig;
  entries: DeployEntry[];
}

export type DeployConfig = DeployTask | DeployTask[];

/**
 * @interface EntryFilters
 * @description 条目过滤器
 */
export interface EntryFilters {
  excludePathRegexps: RegExp[];
  includePathRegexps: RegExp[];
  excludeBasenameRegexps: RegExp[];
  includeBasenameRegexps: RegExp[];
}

/**
 * @interface DeployOptions
 * @description 部署选项
 */
export interface DeployOptions {
  baseDir?: string;
  dryRun?: boolean;
  message?: string;
}
