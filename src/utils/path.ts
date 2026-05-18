/**
 * @module path-utils
 */

import { dirname as nodeDirname, join as nodeJoin, resolve as nodeResolve } from 'node:path';

/**
 * @function toPosix
 * @description 将 Windows 路径转换为 POSIX 格式
 * @param path 路径字符串
 */
export function toPosix(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * @function dirname
 * @description 获取路径的目录部分
 * @param path 路径字符串
 */
export function dirname(path: string): string {
  return toPosix(nodeDirname(path));
}

/**
 * @function normalize
 * @description 规范化路径，移除开头的 ./
 * @param path 路径字符串
 */
export function normalize(path: string): string {
  return toPosix(path).replace(/^(?:\.\/)+/, '');
}

/**
 * @function join
 * @description 连接多个路径片段
 * @param paths 路径片段
 */
export function join(...paths: string[]): string {
  return toPosix(nodeJoin(...paths));
}

/**
 * @function resolve
 * @description 解析绝对路径
 * @param paths 路径片段
 */
export function resolve(...paths: string[]): string {
  return toPosix(nodeResolve(...paths));
}
