import { defineConfig } from 'vite';
import { siteConfig } from './src/runner/site_config.ts';

// `yarn bench:serve`: the Scenario pages against the workspace build of Impulse, for running and profiling by hand.
// Run `yarn build` (or `yarn build:watch`) first so `packages/core/dist` is current.
export default defineConfig(siteConfig('workspace'));
