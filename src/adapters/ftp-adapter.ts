/**
 * @module ftp-adapter
 */

import { Client } from 'basic-ftp';
import { dirname } from '/utils/path';
import { FileWalker } from '/utils/file-walker';
import { FtpOperationContext } from '/types/operation';
import { createLogger, getErrorMessage } from '/utils/logger';
import { DirectoryUploadOptions, TransportAdapter } from '/adapters/transport-adapter';

const DEFAULT_FTP_PORT = 21;
const DEFAULT_FTP_TIMEOUT = 30000;

const logger = createLogger('FtpAdapter');

export class FtpAdapter implements TransportAdapter {
  #client: Client;
  #connected = false;
  #fileWalker: FileWalker;
  #config: FtpOperationContext;
  #ensuredDirs = new Set<string>();

  /**
   * @constructor FtpAdapter
   * @param config FTP 操作上下文
   * @param fileWalker 文件遍历器
   */
  constructor(config: FtpOperationContext, fileWalker: FileWalker) {
    this.#config = config;
    this.#fileWalker = fileWalker;
    this.#client = new Client(this.#config.timeout ?? DEFAULT_FTP_TIMEOUT);
  }

  #assertConnected(): void | never {
    if (!this.#connected) {
      throw new Error('FTP client not connected');
    }
  }

  async #tryRemoveRemotePath(path: string): Promise<void> {
    try {
      await this.#client.removeDir(path);
    } catch (error) {
      const message = getErrorMessage(error);

      logger.debug(`removeDir 失败，尝试删除文件`, { path, error: message });

      try {
        await this.#client.remove(path);
      } catch (removeError) {
        const removeMessage = getErrorMessage(removeError);
        const exists = await this.#remotePathExists(path);

        if (!exists) {
          logger.debug(`远程路径不存在，跳过删除`, { path });

          return;
        }

        throw new Error(`删除远程路径失败: ${path} (removeDir: ${message}; remove: ${removeMessage})`);
      }
    }
  }

  async #remotePathExists(path: string): Promise<boolean> {
    const dir = dirname(path);

    if (!dir || dir === '/') {
      return true;
    }

    try {
      const list = await this.#client.list(dir);

      return list.some(entry => entry.name === path || path.endsWith(`/${entry.name}`));
    } catch (error) {
      const message = getErrorMessage(error);

      logger.warn(`查询远程路径失败，视为不存在`, { path, error: message });

      return false;
    }
  }

  async connect(): Promise<void> {
    if (!this.#connected) {
      this.#client.ftp.verbose = false;

      await this.#client.access({
        host: this.#config.host,
        user: this.#config.user,
        password: this.#config.password,
        secure: this.#config.secure ?? false,
        port: this.#config.port ?? DEFAULT_FTP_PORT
      });

      this.#connected = true;

      logger.info(`FTP 连接成功`, { host: this.#config.host, port: this.#config.port });
    }
  }

  async dispose(): Promise<void> {
    if (this.#connected) {
      await this.#client.close();

      this.#connected = false;

      this.#ensuredDirs.clear();

      logger.info(`FTP 连接已关闭`, { host: this.#config.host });
    }
  }

  async uploadFile(source: string, target: string): Promise<void> {
    this.#assertConnected();

    logger.debug(`上传文件`, { source, target });

    const dir = dirname(target);

    if (dir && dir !== '/') {
      await this.#client.ensureDir(dir);
    }

    await this.#client.uploadFrom(source, target);
  }

  async uploadDirectory(source: string, target: string, options?: DirectoryUploadOptions): Promise<void> {
    this.#assertConnected();

    logger.debug(`上传目录`, { source, target });

    await this.#client.ensureDir(target);

    this.#ensuredDirs.add(target);

    const walker = this.#fileWalker.walk(source, options);

    for await (const entry of walker) {
      if (entry.isFile) {
        const remoteFilePath = `${target}/${entry.relativePath}`;
        const dir = dirname(remoteFilePath);

        if (dir && dir !== '/' && !this.#ensuredDirs.has(dir)) {
          await this.#client.ensureDir(dir);

          this.#ensuredDirs.add(dir);
        }

        await this.#client.uploadFrom(entry.fullPath, remoteFilePath);
      }
    }
  }

  async deleteFile(path: string): Promise<void> {
    this.#assertConnected();

    await this.#client.remove(path);
  }

  async deleteDirectory(path: string): Promise<void> {
    this.#assertConnected();

    logger.debug(`删除目录`, { path });

    await this.#tryRemoveRemotePath(path);
  }
}
