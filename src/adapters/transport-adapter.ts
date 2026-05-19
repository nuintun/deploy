/**
 * @module transport-adapter
 */

/**
 * @interface DirectoryUploadOptions
 * @description 目录上传选项
 */
export interface DirectoryUploadOptions {
  filter?: (relativePath: string) => boolean;
}

/**
 * @interface TransportAdapter
 * @description 传输适配器基础接口，定义所有协议共用的核心操作
 */
export interface TransportAdapter {
  /**
   * @method connect
   * @description 建立连接（可选，仅 FTP 等需要显式连接的协议实现）
   */
  connect?(): Promise<void>;

  /**
   * @method deleteFile
   * @description 删除文件
   * @param path 要删除的文件路径
   */
  deleteFile(path: string): Promise<void>;

  /**
   * @method deleteDirectory
   * @description 删除目录
   * @param path 要删除的目录路径
   */
  deleteDirectory(path: string): Promise<void>;

  /**
   * @method uploadFile
   * @description 上传文件
   * @param source 本地文件路径
   * @param target 远程文件路径
   */
  uploadFile(source: string, target: string): Promise<void>;

  /**
   * @method uploadDirectory
   * @description 上传目录
   * @param source 本地目录路径
   * @param target 远程目录路径
   * @param options 上传选项（包含过滤器）
   */
  uploadDirectory(source: string, target: string, options?: DirectoryUploadOptions): Promise<void>;

  /**
   * @method dispose
   * @description 释放资源（SVN 会在此时提交变更）
   */
  dispose(): Promise<void>;
}
