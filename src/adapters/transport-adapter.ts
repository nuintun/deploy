/**
 * @module transport-adapter
 */

import type { EntryFilters } from '/types/config';

/**
 * @interface TransportAdapter
 * @description 传输适配器基础接口，定义所有协议共用的核心操作
 */
export interface TransportAdapter {
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
   */
  uploadDirectory(source: string, target: string, filters?: EntryFilters): Promise<void>;

  /**
   * @method dispose
   * @description 释放资源
   */
  dispose(): Promise<void>;
}

/**
 * @interface FtpTransportAdapter
 * @description FTP 传输适配器接口，扩展自基础适配器
 */
export interface FtpTransportAdapter extends TransportAdapter {
  /**
   * @method connect
   * @description 建立 FTP 连接
   */
  connect(): Promise<void>;
}

/**
 * @interface SvnTransportAdapter
 * @description SVN 传输适配器接口，扩展自基础适配器
 */
export interface SvnTransportAdapter extends TransportAdapter {
  /**
   * @method commit
   * @description 提交待处理变更
   * @param message 提交说明
   */
  commit(message?: string): Promise<void>;
}
