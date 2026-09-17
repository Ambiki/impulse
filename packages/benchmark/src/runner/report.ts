import type { Variant } from './build.ts';
import type { Comparison, Difference } from './stats.ts';
import { compare, mean, relativeDifference } from './stats.ts';

export interface ScenarioResult {
  scenario: string;
  /** One Sample (the median Iteration of a Round) per Round, per Variant, in milliseconds. */
  samples: Record<Variant, number[]>;
}

export interface ScenarioSummary extends ScenarioResult {
  means: Record<Variant, number>;
  /** Candidate against Baseline. */
  change: Comparison;
  /** The Baseline and the Candidate against the Control. */
  overhead: { baseline: Difference; candidate: Difference };
}

export function summarize(result: ScenarioResult): ScenarioSummary {
  const { samples } = result;
  return {
    ...result,
    means: { baseline: mean(samples.baseline), candidate: mean(samples.candidate), control: mean(samples.control) },
    change: compare(samples.baseline, samples.candidate),
    overhead: {
      baseline: relativeDifference(samples.control, samples.baseline),
      candidate: relativeDifference(samples.control, samples.candidate),
    },
  };
}

function percent(fraction: number): string {
  return `${fraction >= 0 ? '+' : ''}${(fraction * 100).toFixed(1)}%`;
}

function milliseconds(value: number): string {
  return value.toFixed(2);
}

/** A plain-text table: mean Sample per Variant, the Candidate's change with its interval, the Verdict, and Overhead. */
export function formatTable(summaries: ScenarioSummary[]): string {
  const header = ['Scenario', 'Control ms', 'Baseline ms', 'Candidate ms', 'Change [95% CI]', 'Verdict', 'Overhead Baseline → Candidate'];
  const rows = summaries.map(({ scenario, means, change, overhead }) => [
    scenario,
    milliseconds(means.control),
    milliseconds(means.baseline),
    milliseconds(means.candidate),
    `${percent(change.delta)} [${percent(change.interval[0])}, ${percent(change.interval[1])}]`,
    change.verdict,
    `${percent(overhead.baseline.delta)} → ${percent(overhead.candidate.delta)}`,
  ]);

  const widths = header.map((_, column) => Math.max(...[header, ...rows].map((row) => row[column].length)));
  // Text columns align left, numbers right.
  const leftAligned = new Set([0, 5]);
  const line = (row: string[]) =>
    row
      .map((cell, column) => (leftAligned.has(column) ? cell.padEnd(widths[column]) : cell.padStart(widths[column])))
      .join('  ')
      .trimEnd();
  return [line(header), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join('\n');
}

export interface RunInfo {
  chromium: string;
  baseline: { ref: string; sha: string };
  rounds: number;
}

/** Everything a run measured, for `--json`: every Sample, not just the summary. */
export function formatJson(info: RunInfo, summaries: ScenarioSummary[]): string {
  return `${JSON.stringify({ ...info, scenarios: summaries }, null, 2)}\n`;
}
