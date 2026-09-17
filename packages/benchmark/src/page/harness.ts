import type { Scenario } from '../scenarios/scenario.ts';

declare global {
  interface Window {
    /** Present when Chromium runs with `--js-flags=--expose-gc`, as the runner launches it. */
    gc?: () => void;
  }
}

/**
 * Resolves in a later task, after every microtask queued before it (and every microtask those queue) has run.
 * `ImpulseElement` wires targets and actions a few microtasks after insertion, so this is where an Iteration's timed
 * window ends. The page keeps `<body>` at `display: none`, so rendering between tasks has nothing to lay out or paint.
 */
export function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
}

/**
 * Runs `warmup + measured` Iterations of `scenario` and returns the measured durations in milliseconds. Each Iteration
 * also appears in DevTools' Performance panel as a `performance.measure` entry.
 */
export async function iterate(scenario: Scenario, warmup: number, measured: number): Promise<number[]> {
  const durations: number[] = [];
  for (let index = 0; index < warmup + measured; index++) {
    await prepare(scenario);

    const start = performance.now();
    scenario.run();
    await nextTask();
    const end = performance.now();

    const isWarmup = index < warmup;
    performance.measure(`${scenario.name} ${isWarmup ? 'warmup' : 'iteration'} ${index + 1}`, { start, end });
    if (!isWarmup) durations.push(end - start);

    scenario.teardown();
    await nextTask();
  }
  return durations;
}

/**
 * Runs `scenario` once and returns what is wrong with the page afterwards. With Impulse loaded the Scenario judges
 * that itself; without it (the Control) no custom element may be defined at all.
 */
export async function check(scenario: Scenario, loadsImpulse: boolean): Promise<string[]> {
  await prepare(scenario);
  const setupProblems = loadsImpulse ? (scenario.verifySetup?.() ?? []) : [];
  await nextTask();
  scenario.run();
  await nextTask();
  if (loadsImpulse) return [...setupProblems.map((problem) => `before run: ${problem}`), ...scenario.verify()];

  const defined = new Set<string>();
  for (const element of document.querySelectorAll('*')) {
    if (element.localName.includes('-') && customElements.get(element.localName)) defined.add(element.localName);
  }
  return Array.from(defined, (name) => `<${name}> is defined on the Control`);
}

// Setup is untimed: let Impulse finish starting what setup inserted, then collect the garbage setup produced so a
// collection does not land inside the timed window.
async function prepare(scenario: Scenario) {
  scenario.setup();
  await nextTask();
  window.gc?.();
  await nextTask();
}
