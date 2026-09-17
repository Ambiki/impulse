import type { ImpulseSource } from './site_config.ts';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, rm, stat, symlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { build } from 'vite';
import { UsageError } from './args.ts';
import { CORE_DIR, REPO_DIR } from './paths.ts';
import { siteConfig } from './site_config.ts';

const run = promisify(execFile);

export type Variant = 'baseline' | 'candidate' | 'control';

export interface BaselineBuild {
  sha: string;
  /** The built ES module. */
  impulse: string;
}

// Everything under `packages/core` except these is copied for a Candidate build.
const CANDIDATE_SKIPPED = new Set(['dist', 'node_modules', 'test'].map((name) => join(CORE_DIR, name)));

/**
 * Builds Impulse from the working tree, uncommitted changes included, and returns the built ES module. The sources are
 * copied into `workDir` first, so the build starts clean and `packages/core/dist` is left alone.
 */
export async function buildCandidateImpulse(workDir: string): Promise<string> {
  const root = join(workDir, 'candidate-source');
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  await copyFile(join(REPO_DIR, 'tsconfig.json'), join(root, 'tsconfig.json'));
  await cp(CORE_DIR, join(root, 'packages/core'), {
    recursive: true,
    filter: (source) => !CANDIDATE_SKIPPED.has(source),
  });
  const impulse = join(workDir, 'impulse/candidate/index.js');
  await buildImpulse(root, impulse);
  return impulse;
}

/**
 * Builds Impulse as of `ref` in a temporary git worktree. The result is cached by commit SHA and by the working tree's
 * `yarn.lock`, whose toolchain does the building, so a Baseline is built once per commit until the toolchain changes.
 */
export async function buildBaselineImpulse(ref: string, workDir: string): Promise<BaselineBuild> {
  const sha = await resolveRef(ref);
  const impulse = join(workDir, `impulse/${sha}-${await toolchainHash()}/index.js`);
  if (await exists(impulse)) return { sha, impulse };

  const worktree = join(workDir, `worktrees/${sha}`);
  await rm(worktree, { recursive: true, force: true });
  await git('worktree', 'prune');
  await git('worktree', 'add', '--detach', worktree, sha);
  try {
    if (!(await exists(join(worktree, 'packages/core/rollup.config.js')))) {
      throw new UsageError(`${ref} (${sha}) has no packages/core/rollup.config.js to build a Baseline from.`);
    }
    await buildImpulse(worktree, impulse);
  } finally {
    await git('worktree', 'remove', '--force', worktree);
  }
  return { sha, impulse };
}

/** Bundles the Scenario pages for `variant` into `<workDir>/sites/<variant>`. */
export async function buildSite(variant: Variant, impulse: Exclude<ImpulseSource, 'workspace'>, workDir: string) {
  await build(siteConfig(impulse, join(sitesDir(workDir), variant)));
}

export function sitesDir(workDir: string): string {
  return join(workDir, 'sites');
}

/**
 * Runs `packages/core`'s own Rollup build inside `root`, a copy of the repository layout, and copies the ES module to
 * `destination`. `root` has no dependencies installed, so it borrows the working tree's `node_modules`.
 */
async function buildImpulse(root: string, destination: string) {
  const coreDir = join(root, 'packages/core');
  await symlink(join(REPO_DIR, 'node_modules'), join(root, 'node_modules'), 'dir');
  // This process's own Node binary: a worktree of an old ref carries its own `.tool-versions`, which a version manager
  // shim would otherwise try (and possibly fail) to honor.
  const bin = join(REPO_DIR, 'node_modules/rollup/dist/bin/rollup');
  try {
    await run(process.execPath, [bin, '--config', 'rollup.config.js', '--silent'], { cwd: coreDir });
  } catch (error) {
    const { stderr } = error as { stderr?: string };
    throw new Error(`Building Impulse in ${coreDir} failed:\n${stderr ?? String(error)}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(coreDir, 'dist/index.js'), destination);
}

async function resolveRef(ref: string): Promise<string> {
  try {
    // `^{commit}` peels an annotated tag; a name that is both a branch and a tag resolves to the tag, as git does.
    const { stdout } = await git('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`);
    return stdout.trim();
  } catch {
    throw new UsageError(`--baseline "${ref}" is not a commit in this repository.`);
  }
}

async function toolchainHash(): Promise<string> {
  const lockfile = await readFile(join(REPO_DIR, 'yarn.lock'), 'utf8');
  return createHash('sha256').update(lockfile).digest('hex').slice(0, 12);
}

function git(...args: string[]) {
  return run('git', args, { cwd: REPO_DIR });
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}
