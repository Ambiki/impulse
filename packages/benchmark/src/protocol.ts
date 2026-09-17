// How the runner and a Scenario page talk: the page reads what to do from its query string and leaves a promise of the
// result on `window`, which the runner awaits.

/** `auto` runs a Round and resolves to the measured Iteration durations; `check` runs once and resolves to problems. */
export type PageMode = 'auto' | 'check';

export const RESULT_PROPERTY = 'benchResult';

export function scenarioQuery(scenario: string, mode?: PageMode): string {
  return `?scenario=${encodeURIComponent(scenario)}${mode ? `&${mode}` : ''}`;
}

export function readScenarioQuery(search: string): { scenario: string | null; mode: PageMode | null } {
  const params = new URLSearchParams(search);
  const mode = params.has('auto') ? 'auto' : params.has('check') ? 'check' : null;
  return { scenario: params.get('scenario'), mode };
}
