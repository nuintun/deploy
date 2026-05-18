/**
 * @module operation
 */

import { EntryFilters } from '/types/config';

/**
 * @enum OperationType
 * @description 部署操作类型枚举
 */
export const enum OperationType {
  UPLOAD_FILE,
  UPLOAD_DIRECTORY,
  DELETE_FILE,
  DELETE_DIRECTORY,
  SVN_DELETE,
  SVN_COMMIT
}

/**
 * @interface FtpOperationContext
 * @description FTP 操作上下文
 */
export interface FtpOperationContext {
  host: string;
  user: string;
  port?: number;
  adapter: 'ftp';
  password: string;
  secure?: boolean;
  timeout?: number;
  adapterKey: string;
}

/**
 * @interface SvnOperationContext
 * @description SVN 操作上下文
 */
export interface SvnOperationContext {
  adapter: 'svn';
  workspace: string;
  adapterKey: string;
  commitMessage?: string;
  cleanBeforeDeploy?: boolean;
}

export type OperationContext = FtpOperationContext | SvnOperationContext;

/**
 * @interface BaseOperation
 * @description 基础操作
 */
export interface BaseOperation {
  id: string;
  description: string;
  type: OperationType;
  filters?: EntryFilters;
  context?: OperationContext;
}

/**
 * @interface UploadFileOperation
 * @description 上传文件操作
 */
export interface UploadFileOperation extends BaseOperation {
  source: string;
  target: string;
  type: OperationType.UPLOAD_FILE;
}

/**
 * @interface UploadDirectoryOperation
 * @description 上传目录操作
 */
export interface UploadDirectoryOperation extends BaseOperation {
  source: string;
  target: string;
  type: OperationType.UPLOAD_DIRECTORY;
}

/**
 * @interface DeleteFileOperation
 * @description 删除文件操作
 */
export interface DeleteFileOperation extends BaseOperation {
  target: string;
  type: OperationType.DELETE_FILE;
}

/**
 * @interface DeleteDirectoryOperation
 * @description 删除目录操作
 */
export interface DeleteDirectoryOperation extends BaseOperation {
  target: string;
  type: OperationType.DELETE_DIRECTORY;
}

/**
 * @interface SvnDeleteOperation
 * @description SVN 删除操作
 */
export interface SvnDeleteOperation extends BaseOperation {
  target: string;
  isDirectory: boolean;
  context?: SvnOperationContext;
  type: OperationType.SVN_DELETE;
}

/**
 * @interface SvnCommitOperation
 * @description SVN 提交操作
 */
export interface SvnCommitOperation extends BaseOperation {
  type: OperationType.SVN_COMMIT;
  context?: SvnOperationContext;
}

export type Operation =
  | UploadFileOperation
  | UploadDirectoryOperation
  | DeleteFileOperation
  | DeleteDirectoryOperation
  | SvnDeleteOperation
  | SvnCommitOperation;

/**
 * @interface DeployPlan
 * @description 部署计划
 */
export interface DeployPlan {
  name: string;
  operations: Operation[];
}

/**
 * @interface ExecutionContext
 * @description 执行上下文
 */
export interface ExecutionContext {
  dryRun: boolean;
  baseDir: string;
  message?: string;
}

/**
 * @interface OperationResult
 * @description 单个操作的执行结果（判别联合类型）
 */
export type OperationResult =
  | { success: true; operationId: string; duration?: number }
  | { success: false; operationId: string; error: string; duration?: number };

/**
 * @interface ExecutionResult
 * @description 部署计划的执行结果
 */
export interface ExecutionResult {
  success: boolean;
  totalDuration?: number;
  operationResults: OperationResult[];
}
