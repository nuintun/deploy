/**
 * @module glob
 */

import { toPosix } from './path';

// RegExp 特殊字符转义
const REGEX_SPECIAL_CHARS = /[.+^${}()|[\]\\]/g;

/**
 * @function escapeRegex
 * @description 转义 RegExp 特殊字符
 * @param input - 输入字符串
 * @returns 转义后的字符串
 */
function escapeRegex(input: string): string {
  return input.replace(REGEX_SPECIAL_CHARS, '\\$&');
}

/**
 * @function globToRegex
 * @description 将 glob 模式转换为 RegExp
 *
 * 支持：
 *   *       匹配单个路径段中的任意字符（不跨 /）
 *   ?       匹配单个字符（不跨 /）
 *   globstar 匹配零或多层目录（连续两个星号）
 *
 * 说明：
 *   - 所有路径会先标准化为 POSIX 风格（/）
 *   - 仅在路径边界处的 globstar 才视为目录通配
 *   - 非边界的 globstar（如 a{globstar}b）视为普通通配
 *
 * 示例：
 *
 *   *.txt
 *     -> /^[^/]*\.txt$/
 *
 *   src/{globstar}/*.js
 *     -> /^src\/(?:[^/]+\/)*[^/]*\.js$/
 *
 *   dist/{globstar}/index.js
 *     -> /^dist\/(?:[^/]+\/)*index\.js$/
 *
 *   assets/{globstar}
 *     -> /^assets\/?(?:[^/]+(?:\/[^/]+)*)?$/
 *
 *   a/b?c
 *     -> /^a\/b[^/]c$/
 *
 * @param pattern - glob 模式字符串
 * @param caseSensitive - 是否区分大小写，默认 Windows 不区分，其他平台区分
 * @returns 编译后的正则表达式，匹配整个字符串
 */
export function globToRegex(pattern: string, caseSensitive = process.platform !== 'win32'): RegExp {
  let i = 0;
  let regex = '^';

  pattern = toPosix(pattern);

  while (i < pattern.length) {
    const char = pattern[i];

    // globstar **
    //
    // 仅在路径边界视为 globstar：
    //
    //   **
    //   **/
    //   /**/
    //   foo/**
    //   foo/**/bar
    //
    // 非边界（如 a**b）退化为普通通配
    if (char === '*' && pattern[i + 1] === '*') {
      const prev = pattern[i - 1];
      const next = pattern[i + 2];
      const leftBoundary = prev == null || prev === '/';
      const rightBoundary = next == null || next === '/';

      // 真正 globstar
      if (leftBoundary && rightBoundary) {
        // **/
        if (next === '/') {
          regex += '(?:[^/]+/)*';
          i += 3;
          continue;
        }

        // 结尾 ** — 匹配零或多个路径段
        if (prev === '/') {
          regex += '?(?:[^/]+(?:/[^/]+)*)?';
        } else if (prev == null) {
          regex += '[^/]+(?:/[^/]+)*';
        } else {
          regex += '(?:/[^/]+)*(?:/[^/]*)?';
        }

        i += 2;
        continue;
      }

      // 非 globstar：等价两个普通 *
      regex += '[^/]*';
      i += 2;
      continue;
    }

    // *
    if (char === '*') {
      regex += '[^/]*';
      i++;
      continue;
    }

    // ?
    if (char === '?') {
      regex += '[^/]';
      i++;
      continue;
    }

    // 普通字符
    regex += escapeRegex(char);
    i++;
  }

  regex += '$';

  return new RegExp(regex, caseSensitive ? '' : 'i');
}
