/**
 * @module fix-types
 */

import { resolvePaths } from 'dts-paths';

Promise.all([
  resolvePaths('esm', {
    tsconfig: {
      extends: './tsconfig.json',
      compilerOptions: {
        rootDir: 'esm',
        paths: {
          '/*': ['./esm/*']
        }
      }
    }
  })
]).then(
  ([esm]) => {
    console.log(`fix esm types: ${esm.size} files`);
  },
  error => {
    console.error(error);
  }
);
