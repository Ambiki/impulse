import { loadsImpulse } from 'bench:components';
import { readScenarioQuery } from '../protocol.ts';
import { scenarios } from '../scenarios/index.ts';
import { check, iterate, nextTask } from './harness.ts';
import { mountIndex, mountScenario } from './ui.ts';

declare global {
  interface Window {
    /** `RESULT_PROPERTY` in `../protocol.ts`. */
    benchResult?: Promise<number[] | string[]>;
  }
}

const { scenario: name, mode } = readScenarioQuery(location.search);
const scenario = scenarios.find((candidate) => candidate.name === name);

if (mode) {
  window.benchResult = loaded().then((): Promise<number[] | string[]> => {
    if (!scenario) throw new Error(`Unknown Scenario "${name}".`);
    if (mode === 'check') return check(scenario, loadsImpulse);
    // Without these the numbers are still produced, just worse: 100µs timers and collections inside timed windows.
    if (!crossOriginIsolated) throw new Error('The page is not cross-origin isolated; serve it with COOP and COEP.');
    if (!window.gc) throw new Error('`gc()` is unavailable; launch Chromium with --js-flags=--expose-gc.');
    return iterate(scenario, scenario.warmup, scenario.measured);
  });
} else if (scenario) {
  mountScenario(scenario);
} else {
  mountIndex(scenarios);
}

// Start measuring only once the load event has fired, so page loading does not share the first Iterations' tasks.
async function loaded() {
  if (document.readyState !== 'complete') {
    await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
  }
  await nextTask();
}
