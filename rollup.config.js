import typescript from '@rollup/plugin-typescript';
import { readFileSync } from 'fs';

const json = JSON.parse(readFileSync('./package.json'));
const banner = `/*\nImpulse ${json.version}\n */`;

/**
 * @type {import('rollup').RollupOptions}
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
    plugins: [typescript()],
  },
];
