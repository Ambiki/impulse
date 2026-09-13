import { esbuildPlugin } from '@web/dev-server-esbuild';
import { playwrightLauncher } from '@web/test-runner-playwright';

// https://modern-web.dev/docs/test-runner/cli-and-configuration/
export default {
  rootDir: '.',
  files: ['./test/**/*.test.ts'],
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
    playwrightLauncher({ product: 'firefox' }),
    playwrightLauncher({ product: 'webkit' }),
  ],
  concurrentBrowsers: 3,
  nodeResolve: true,
  preserveSymlinks: true,
  plugins: [esbuildPlugin({ ts: true, target: 'es2020' })],
  watch: process.argv.includes('--watch'),
};
