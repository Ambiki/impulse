import { playwrightLauncher } from '@web/test-runner-playwright';
import { profileFiles, profilePlugin } from './web-test-runner.profiles.js';

// `PROFILE=tsc-legacy yarn test` runs the suite compiled as another project setup would; see the profiles file.
const profile = process.env.PROFILE ?? 'esbuild-legacy';

// https://modern-web.dev/docs/test-runner/cli-and-configuration/
export default {
  rootDir: '.',
  files: profileFiles(profile),
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
    playwrightLauncher({ product: 'firefox' }),
    playwrightLauncher({ product: 'webkit' }),
  ],
  concurrentBrowsers: 3,
  nodeResolve: true,
  preserveSymlinks: true,
  plugins: [profilePlugin(profile)],
  watch: process.argv.includes('--watch'),
};
