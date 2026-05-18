/**
 * @module file-walker
 */

import { basename } from 'node:path';
import { EntryFilters } from '/types/config';
import { join, normalize, resolve } from './path';
import { lstat, readdir, realpath } from 'node:fs/promises';

/**
 * @interface WalkEntry
 * @description 文件遍历条目
 */
export interface WalkEntry {
  fullPath: string;
  relativePath: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}

/**
 * @interface WalkOptions
 * @description 文件遍历选项
 */
export interface WalkOptions {
  filters?: EntryFilters;
  followSymlinks?: boolean;
}

/**
 * @interface ReadEntry
 * @description 目录读取条目
 */
interface ReadEntry {
  name: string;
  path: string;
  source: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}

type Waiting = [root: string, relativePath: string, iterator: AsyncGenerator<ReadEntry>];

/**
 * @function readEntries
 * @description 读取目录条目
 * @param fullPath 目录完整路径
 * @param followSymlinks 是否跟随符号链接
 */
async function* readEntries(fullPath: string, followSymlinks: boolean): AsyncGenerator<ReadEntry> {
  const dirents = await readdir(fullPath, { withFileTypes: true });

  for (const dirent of dirents) {
    const { name } = dirent;
    const path = join(fullPath, name);

    let source = path;
    let isFile = dirent.isFile();
    let isDirectory = dirent.isDirectory();
    let isSymbolicLink = dirent.isSymbolicLink();

    if (dirent.isSymbolicLink() && followSymlinks) {
      try {
        source = await realpath(path);

        const stat = await lstat(source);

        isFile = stat.isFile();
        isDirectory = stat.isDirectory();
      } catch {
        continue;
      }
    }

    yield { name, path, source, isSymbolicLink, isFile, isDirectory };
  }
}

export class FileWalker {
  #matchesFilters(filters: EntryFilters | undefined, relativePath: string): boolean {
    if (!filters) {
      return true;
    }

    const normalized = normalize(relativePath);
    const baseName = basename(normalized);

    for (const regex of filters.excludeBasenameRegexps) {
      if (regex.test(baseName)) {
        return false;
      }
    }

    for (const regex of filters.excludePathRegexps) {
      if (regex.test(normalized)) {
        return false;
      }
    }

    const hasInclude = filters.includeBasenameRegexps.length > 0 || filters.includePathRegexps.length > 0;

    if (!hasInclude) {
      return true;
    }

    for (const regex of filters.includeBasenameRegexps) {
      if (regex.test(baseName)) {
        return true;
      }
    }

    for (const regex of filters.includePathRegexps) {
      if (regex.test(normalized)) {
        return true;
      }
    }

    return false;
  }

  #shouldDescendDirectory(filters: EntryFilters | undefined, relativeDir: string): boolean {
    if (!filters) {
      return true;
    }

    const normalized = normalize(relativeDir);
    const baseName = basename(normalized);

    for (const regex of filters.excludeBasenameRegexps) {
      if (regex.test(baseName)) {
        return false;
      }
    }

    for (const regex of filters.excludePathRegexps) {
      if (regex.test(normalized)) {
        return false;
      }
    }

    return true;
  }

  async *walk(baseDir: string, options: WalkOptions = {}): AsyncGenerator<WalkEntry, void, unknown> {
    baseDir = resolve(baseDir);

    const followSymlinks = options.followSymlinks ?? false;
    const visited = followSymlinks ? new Set<string>([await realpath(baseDir)]) : null;

    const stat = await lstat(baseDir);

    if (stat.isFile()) {
      yield {
        isFile: true,
        fullPath: baseDir,
        isDirectory: false,
        relativePath: basename(baseDir),
        isSymbolicLink: stat.isSymbolicLink()
      };
      return;
    }

    if (!stat.isDirectory()) {
      return;
    }

    const waiting: Waiting[] = [];

    let current: Waiting | undefined = [baseDir, '', readEntries(baseDir, followSymlinks)];

    while (current) {
      const [root, currentRelativePath, iterator] = current;
      const iteratorResult = await iterator.next();

      if (iteratorResult.done) {
        current = waiting.pop();
      } else {
        const entry = iteratorResult.value;

        if (visited && visited.has(entry.source)) {
          continue;
        }

        if (visited) {
          visited.add(entry.source);
        }

        const childRelativePath = currentRelativePath ? join(currentRelativePath, entry.name) : entry.name;

        if (entry.isFile) {
          if (!this.#matchesFilters(options.filters, childRelativePath)) {
            continue;
          }

          yield {
            isFile: true,
            isDirectory: false,
            fullPath: entry.path,
            relativePath: childRelativePath,
            isSymbolicLink: entry.isSymbolicLink
          };
        } else if (entry.isDirectory) {
          if (!this.#shouldDescendDirectory(options.filters, childRelativePath)) {
            continue;
          }

          waiting.push([root, childRelativePath, readEntries(entry.path, followSymlinks)]);
        }
      }
    }
  }
}
