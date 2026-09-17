import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_DIR = fileURLToPath(new URL('../../', import.meta.url));
export const REPO_DIR = join(PACKAGE_DIR, '../..');
export const CORE_DIR = join(REPO_DIR, 'packages/core');
/** Builds, worktrees and sites for `yarn bench`. Gitignored and safe to delete. */
export const WORK_DIR = join(PACKAGE_DIR, '.bench');
/** The same for the tests, so running them never replaces a site a benchmark run is serving. */
export const TEST_WORK_DIR = join(WORK_DIR, 'test');
