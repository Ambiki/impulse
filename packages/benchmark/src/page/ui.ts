import type { Scenario } from '../scenarios/scenario.ts';
import { scenarioQuery } from '../protocol.ts';
import { median } from '../runner/stats.ts';
import { iterate } from './harness.ts';

// `<body>` holds the fixture: it is hidden, emptied between Iterations, and replaced outright by `body-swap`. The
// controls therefore live in an `<aside>` beside it, directly under `<html>`.
function panel(): HTMLElement {
  const aside = document.createElement('aside');
  document.documentElement.append(aside);
  return aside;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

export function mountIndex(scenarios: Scenario[]) {
  const aside = panel();
  const list = element('ul');
  for (const { name } of scenarios) {
    const link = element('a', name);
    link.href = scenarioQuery(name);
    const item = element('li');
    item.append(link);
    list.append(item);
  }
  aside.append(
    element('h1', 'Impulse benchmark'),
    element('p', 'Open a Scenario to time it by hand or record it in the DevTools Performance panel.'),
    list,
  );
}

export function mountScenario(scenario: Scenario) {
  const aside = panel();
  const back = element('a', '← All Scenarios');
  back.href = location.pathname;
  const runOnce = element('button', 'Run');
  const runTen = element('button', 'Run ×10');
  const results = element('ol');
  const summary = element('p');
  const durations: number[] = [];

  async function run(count: number) {
    runOnce.disabled = true;
    runTen.disabled = true;
    try {
      for (const duration of await iterate(scenario, 0, count)) {
        durations.push(duration);
        results.append(element('li', `${duration.toFixed(2)} ms`));
      }
      summary.textContent = `Median of ${durations.length}: ${median(durations).toFixed(2)} ms`;
    } finally {
      runOnce.disabled = false;
      runTen.disabled = false;
    }
  }

  runOnce.addEventListener('click', () => run(1));
  runTen.addEventListener('click', () => run(10));
  aside.append(back, element('h1', scenario.name), runOnce, runTen, summary, results);
}
