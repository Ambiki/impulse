import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import typescript from '@rollup/plugin-typescript';

const json = JSON.parse(readFileSync('./package.json'));
const banner = `/*\nImpulse ${json.version} © ${new Date().getFullYear()} Ambitious Idea Labs\n */`;

const root = path.dirname(fileURLToPath(import.meta.url));
const main = path.join(root, 'src', 'index');
const testing = path.join(root, 'src', 'testing');

/**
 * Keeps the testing entry point from bundling a copy of Impulse. It imports Impulse's public API from `src/index`, as
 * Impulse's own tests run it from source; in the build that import becomes `@ambiki/impulse`, so both entry points
 * share the one instance a project loads (an element of a second copy would not be an instance of its
 * `ImpulseElement`). Anything else outside `src/testing` would be bundled, so it fails the build.
 */
function importImpulseByName() {
  return {
    name: 'import-impulse-by-name',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return null;
      const resolved = path.resolve(path.dirname(importer), source).replace(/\.ts$/, '');
      if (resolved === main) return { id: '@ambiki/impulse', external: true };
      if (resolved !== testing && !resolved.startsWith(`${testing}${path.sep}`)) {
        const file = path.relative(root, importer);
        this.error(`${file} imports "${source}". The testing entry point may import only "src/index".`);
      }
      return null;
    },
  };
}

/**
 * @type {import('rollup').RollupOptions[]}
 */
export default [
  {
    input: 'src/index.ts',
    output: [
      {
        banner,
        file: 'dist/index.umd.js',
        format: 'umd',
        name: 'Impulse',
      },
      {
        banner,
        file: 'dist/index.js',
        format: 'es',
      },
    ],
    plugins: [typescript({ tsconfig: './tsconfig.build.json' })],
  },
  {
    input: 'src/testing/index.ts',
    output: [
      {
        banner,
        file: 'dist/testing.js',
        format: 'es',
      },
      // Jest, in its default mode, loads `@ambiki/impulse` through `require`, and so must load this entry point, to get
      // the same instance.
      {
        banner,
        file: 'dist/testing.cjs',
        format: 'cjs',
      },
    ],
    plugins: [importImpulseByName(), typescript({ tsconfig: './tsconfig.build.json' })],
  },
];
