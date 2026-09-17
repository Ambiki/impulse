import type { InlineConfig } from 'vite';
import { join } from 'node:path';
import { PACKAGE_DIR } from './paths.ts';

/**
 * `crossOriginIsolated` pages get 5µs `performance.now()` resolution instead of 100µs, which matters for the short
 * attribute Scenarios.
 */
export const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

/**
 * The Impulse a site bundles: a built ES module, whatever `@ambiki/impulse` resolves to in the workspace, or none at all
 * for the Control, which then loads no components either.
 */
export type ImpulseSource = { module: string } | 'workspace' | 'none';

export function siteConfig(impulse: ImpulseSource, outDir?: string): InlineConfig {
  const components = join(PACKAGE_DIR, 'src/components', impulse === 'none' ? 'control.ts' : 'index.ts');
  return {
    root: PACKAGE_DIR,
    base: './',
    configFile: false,
    logLevel: 'warn',
    resolve: {
      alias: [
        { find: /^bench:components$/, replacement: components },
        ...(typeof impulse === 'object' ? [{ find: /^@ambiki\/impulse$/, replacement: impulse.module }] : []),
      ],
    },
    server: { port: 3001, headers: ISOLATION_HEADERS },
    build: { outDir, emptyOutDir: true },
  };
}
