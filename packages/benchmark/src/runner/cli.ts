import type { Variant } from './build.ts';
import type { ScenarioResult } from './report.ts';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { scenarios } from '../scenarios/index.ts';
import { parseArgs, UsageError } from './args.ts';
import { buildBaselineImpulse, buildCandidateImpulse, buildSite, sitesDir } from './build.ts';
import { WORK_DIR } from './paths.ts';
import { formatJson, formatTable, summarize } from './report.ts';
import { runRound } from './run.ts';
import { schedule } from './schedule.ts';
import { serve } from './server.ts';
import { median, NO_CHANGE_BAND } from './stats.ts';

const VARIANTS: Variant[] = ['baseline', 'candidate', 'control'];

const USAGE = `Usage: yarn bench [options]

Compares the working tree's build of Impulse (the Candidate) against a git ref (the Baseline) in Chromium, with a
no-Impulse Control for Overhead.

Options:
  --baseline <ref>     Git ref to build the Baseline from (default: main)
  --rounds <n>         Rounds per Variant, per Scenario (default: 10; use 30 for numbers in a pull request)
  --scenario <glob>    Only Scenarios matching the glob; repeatable, \`*\` matches anything (default: all)
  --json <path>        Also write every Sample and comparison to this file
  -h, --help           Show this message

Scenarios:
  ${scenarios.map(({ name }) => name).join('\n  ')}`;

async function main() {
  const options = parseArgs(process.argv.slice(2), scenarios.map(({ name }) => name));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  log('Building the Candidate from the working tree');
  const candidate = await buildCandidateImpulse(WORK_DIR);
  log(`Building the Baseline from ${options.baseline}`);
  const baseline = await buildBaselineImpulse(options.baseline, WORK_DIR);
  log('Bundling the Scenario pages');
  await buildSite('baseline', { module: baseline.impulse }, WORK_DIR);
  await buildSite('candidate', { module: candidate }, WORK_DIR);
  await buildSite('control', 'none', WORK_DIR);

  const server = await serve(sitesDir(WORK_DIR));
  const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] });
  try {
    log(
      `Chromium ${browser.version()}, Baseline ${options.baseline} (${baseline.sha.slice(0, 10)}), ` +
      `${options.rounds} Rounds per Variant`,
    );
    const results: ScenarioResult[] = [];
    for (const scenario of options.scenarios) {
      const samples: Record<Variant, number[]> = { baseline: [], candidate: [], control: [] };
      const order = schedule(VARIANTS, options.rounds);
      const started = Date.now();
      for (const [index, variant] of order.entries()) {
        progress(`${scenario}: Round ${index + 1}/${order.length}, ${seconds(Date.now() - started)}`);
        samples[variant].push(median(await runRound(browser, server.origin, variant, scenario)));
      }
      progress('');
      log(`${scenario}: ${order.length} Rounds in ${seconds(Date.now() - started)}`);
      results.push({ scenario, samples });
    }

    const summaries = results.map(summarize);
    console.log(`\n${formatTable(summaries)}\n`);
    console.log(
      `Change is Candidate against Baseline; a Verdict of "no change" means the interval sits within ±${NO_CHANGE_BAND * 100}%.`,
    );
    console.log('Overhead is the Baseline and the Candidate against the Control, which runs the same DOM operations without Impulse.');

    if (options.json) {
      const info = {
        chromium: browser.version(),
        baseline: { ref: options.baseline, sha: baseline.sha },
        rounds: options.rounds,
      };
      // Yarn runs workspace scripts from the package directory; resolve against where `yarn bench` was typed.
      const path = resolve(process.env.INIT_CWD ?? process.cwd(), options.json);
      await writeFile(path, formatJson(info, summaries));
      log(`Wrote ${path}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

function log(message: string) {
  console.log(`[bench] ${message}`);
}

// Rewrites one status line in place when attached to a terminal; silent otherwise, so piped output stays clean.
function progress(message: string) {
  if (!process.stdout.isTTY) return;
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(message);
}

function seconds(milliseconds: number): string {
  return `${Math.round(milliseconds / 1000)}s`;
}

main().catch((error) => {
  console.error(error instanceof UsageError ? error.message : error);
  process.exitCode = error instanceof UsageError ? 2 : 1;
});
