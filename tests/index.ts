/**
 * @module tests/index
 */

async function main(): Promise<void> {
  const { globToRegex } = await import('../esm/utils/glob.js');
  const { toPosix, dirname, normalize, join, resolve } = await import('../esm/utils/path.js');

  let totalPassed = 0;
  let totalFailed = 0;

  console.log('\n========== globToRegex 测试 ==========\n');

  const globCases: { pattern: string; input: string; expected: boolean }[] = [
    { pattern: '*.txt', input: 'file.txt', expected: true },
    { pattern: '*.txt', input: 'file.js', expected: false },
    { pattern: '*.txt', input: 'dir/file.txt', expected: false },
    { pattern: 'src/**/*.js', input: 'src/foo.js', expected: true },
    { pattern: 'src/**/*.js', input: 'src/a/b/c.js', expected: true },
    { pattern: 'src/**/*.js', input: 'src/a/b/c.ts', expected: false },
    { pattern: 'dist/**/index.js', input: 'dist/index.js', expected: true },
    { pattern: 'dist/**/index.js', input: 'dist/a/b/index.js', expected: true },
    { pattern: 'dist/**/index.js', input: 'dist/a/b/other.js', expected: false },
    { pattern: 'assets/**', input: 'assets', expected: true },
    { pattern: 'assets/**', input: 'assets/foo', expected: true },
    { pattern: 'assets/**', input: 'assets/foo/bar', expected: true },
    { pattern: 'a/b?c', input: 'a/bxc', expected: true },
    { pattern: 'a/b?c', input: 'a/b/c', expected: false },
    { pattern: 'a/b?c', input: 'a/bcc', expected: true },
    { pattern: '**', input: '', expected: false },
    { pattern: '**', input: 'foo', expected: true },
    { pattern: '**', input: 'foo/bar', expected: true },
    { pattern: 'a**b', input: 'axyzb', expected: true },
    { pattern: 'a**b', input: 'a/b', expected: false },
    { pattern: '*.map', input: 'app.js.map', expected: true },
    { pattern: '*.map', input: 'app.js', expected: false },
    { pattern: 'test/**', input: 'test', expected: true },
    { pattern: 'test/**', input: 'test/unit', expected: true },
    { pattern: 'test/**', input: 'test/unit/a.spec.ts', expected: true },
    { pattern: 'test/**', input: 'other', expected: false }
  ];

  let globPassed = 0;
  let globFailed = 0;

  for (const { pattern, input, expected } of globCases) {
    const regex = globToRegex(pattern, true);
    const actual = regex.test(input);

    if (actual === expected) {
      globPassed++;
    } else {
      globFailed++;
      console.error(`  ✗ globToRegex('${pattern}').test('${input}') = ${actual}, expected ${expected}`);
    }
  }

  console.log(`  ✓ globToRegex: ${globPassed}/${globCases.length} passed`);
  totalPassed += globPassed;
  totalFailed += globFailed;

  console.log('\n========== path-utils 测试 ==========\n');

  const pathTests: { label: string; fn: () => boolean }[] = [
    { label: 'toPosix converts backslashes', fn: () => toPosix('a\\b\\c') === 'a/b/c' },
    { label: 'toPosix leaves forward slashes unchanged', fn: () => toPosix('a/b/c') === 'a/b/c' },
    { label: 'dirname returns posix dirname', fn: () => dirname('/a/b/c') === '/a/b' },
    { label: 'dirname returns posix dirname for windows path', fn: () => dirname('C:\\a\\b\\c') === 'C:/a/b' },
    { label: 'normalize strips ./ prefix', fn: () => normalize('./foo/bar') === 'foo/bar' },
    { label: 'normalize strips multiple ./ prefixes', fn: () => normalize('././foo') === 'foo' },
    { label: 'normalize converts backslashes', fn: () => normalize('.\\foo\\bar') === 'foo/bar' },
    { label: 'join combines paths in posix format', fn: () => join('a', 'b', 'c') === 'a/b/c' },
    { label: 'join handles windows paths', fn: () => join('C:\\a', 'b') === 'C:/a/b' },
    {
      label: 'resolve returns absolute posix path',
      fn: () => {
        const result = resolve('/a', 'b', 'c');
        return result.includes('/') && !result.includes('\\');
      }
    }
  ];

  let pathPassed = 0;
  let pathFailed = 0;

  for (const { label, fn } of pathTests) {
    try {
      if (fn()) {
        pathPassed++;
      } else {
        pathFailed++;
        console.error(`  ✗ ${label}: assertion failed`);
      }
    } catch (error) {
      pathFailed++;
      console.error(`  ✗ ${label}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`  ✓ path-utils: ${pathPassed}/${pathTests.length} passed`);
  totalPassed += pathPassed;
  totalFailed += pathFailed;

  console.log('\n========== SvnAdapter.#assertSafePath 测试 ==========\n');

  function assertSafePath(path: string): void {
    const normalized = toPosix(path).trim();

    if (!normalized || normalized === '.' || normalized === '/') {
      throw new Error(`路径不合法: ${path}`);
    }

    if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('//')) {
      throw new Error(`不允许绝对路径: ${path}`);
    }

    const segments = normalized.split('/').filter(Boolean);

    if (segments[0] === '..' || segments.includes('..')) {
      throw new Error(`路径疑似越界: ${path}`);
    }
  }

  const shouldPass = ['foo/bar', 'a/b/c.txt', 'dir', 'a-b/c_d.e'];
  const shouldFail = ['', '.', '/', '..', '../foo', 'a/../b', 'C:/foo', '//foo'];

  let safePassed = 0;
  let safeFailed = 0;

  for (const path of shouldPass) {
    try {
      assertSafePath(path);
      safePassed++;
    } catch (error) {
      safeFailed++;
      console.error(`  ✗ 应通过但失败: "${path}" - ${error instanceof Error ? error.message : error}`);
    }
  }

  for (const path of shouldFail) {
    try {
      assertSafePath(path);
      safeFailed++;
      console.error(`  ✗ 应失败但通过: "${path}"`);
    } catch {
      safePassed++;
    }
  }

  const safeTotal = shouldPass.length + shouldFail.length;
  console.log(`  ✓ SvnAdapter.#assertSafePath: ${safePassed}/${safeTotal} passed`);
  totalPassed += safePassed;
  totalFailed += safeFailed;

  console.log('\n========== 测试汇总 ==========');
  console.log(`  总计: ${totalPassed} passed, ${totalFailed} failed\n`);

  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('测试运行失败:', error);
  process.exitCode = 1;
});
