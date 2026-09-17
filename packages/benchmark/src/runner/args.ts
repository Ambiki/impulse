import { parseArgs as parseNodeArgs } from 'node:util';

export interface Options {
  /** Git ref the Baseline is built from. */
  baseline: string;
  /** Rounds per Variant, per Scenario. */
  rounds: number;
  /** Names of the Scenarios to run, in registry order. */
  scenarios: string[];
  /** Where to write the results as JSON, if anywhere. */
  json: string | undefined;
  help: boolean;
}

/** A mistake in the command line, reported to the user without a stack trace. */
export class UsageError extends Error {}

export function parseArgs(argv: string[], scenarioNames: string[]): Options {
  const { values } = parseOptions(argv);

  return {
    baseline: values.baseline ?? 'main',
    rounds: parseRounds(values.rounds ?? '10'),
    scenarios: selectScenarios(scenarioNames, values.scenario),
    json: values.json,
    help: values.help ?? false,
  };
}

function parseOptions(argv: string[]) {
  try {
    return parseNodeArgs({
      args: argv,
      options: {
        baseline: { type: 'string' },
        rounds: { type: 'string' },
        scenario: { type: 'string', multiple: true },
        json: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    // `node:util` throws a TypeError for unknown options and missing values; its message already names the option.
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

// Welch's interval needs a variance, so at least two Samples per Variant.
function parseRounds(value: string): number {
  const rounds = Number(value);
  if (value.trim() === '' || !Number.isInteger(rounds) || rounds < 2) {
    throw new UsageError(`--rounds must be a whole number of at least 2, got "${value}".`);
  }
  return rounds;
}

// `*` matches any run of characters, `/` included, so `table-*` selects every table Scenario.
function selectScenarios(names: string[], patterns: string[] | undefined): string[] {
  if (!patterns) return names;
  const matchers = patterns.map((pattern) => {
    const matcher = globToRegExp(pattern);
    if (!names.some((name) => matcher.test(name))) {
      throw new UsageError(`--scenario "${pattern}" matches no Scenario. Scenarios:\n  ${names.join('\n  ')}`);
    }
    return matcher;
  });
  return names.filter((name) => matchers.some((matcher) => matcher.test(name)));
}

function globToRegExp(pattern: string): RegExp {
  const source = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${source}$`);
}
