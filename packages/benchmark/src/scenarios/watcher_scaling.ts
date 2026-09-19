import type { Scenario } from './scenario.ts';
import { expectEqual, fixture, range, STARTED_ATTRIBUTE, startedCount } from './fixtures.ts';

const ROWS = 1_000;
// The two selectors Impulse registers for itself, plus nothing. What every other Scenario runs with.
const FEW = 0;
// A large application's worth of `lazyImport` calls, none of which ever match.
const MANY = 25;

interface DataTable extends HTMLElement {
  labels: HTMLElement[];
  deleteButtons: HTMLElement[];
}

function row(id: number): string {
  return (
    `<div role="row" data-id="${id}" data-action="click->data-table#select keydown->data-table#navigate">` +
    `<div role="gridcell">${id}</div>` +
    `<div role="gridcell"><span data-target="data-table.labels">Row ${id}</span></div>` +
    `<div role="gridcell"><button type="button" data-target="data-table.deleteButtons">Delete</button></div>` +
    `</div>`
  );
}

function rowGroup(): HTMLElement {
  return document.querySelector('[role="rowgroup"]')!;
}

function table(): DataTable {
  return document.querySelector('data-table') as DataTable;
}

function verifyRows(count: number): string[] {
  const problems: string[] = [];
  const host = document.querySelector('watcher-host')!;
  expectEqual(problems, '<watcher-host> started', host.hasAttribute(STARTED_ATTRIBUTE), true);
  expectEqual(problems, '<data-table> started', table().hasAttribute(STARTED_ATTRIBUTE), true);
  expectEqual(problems, 'rows', rowGroup().children.length, count);
  expectEqual(problems, 'label targets', table().labels.length, count);
  expectEqual(problems, 'delete button targets', table().deleteButtons.length, count);
  expectEqual(problems, 'rows started', startedCount(Array.from(rowGroup().children)), 0);
  return problems;
}

/**
 * Times a subtree insertion and a subtree removal against a fixed number of registered watchers, so the two families
 * read side by side say how enumerating a mutated subtree scales with the number of selectors the observer holds.
 */
function watcherScenarios(family: string, extraWatchers: number, description: string): Scenario[] {
  const page = fixture(
    () =>
      `<watcher-host count="${extraWatchers}"></watcher-host>` +
      `<data-table role="grid"><div role="rowgroup"></div></data-table>`,
  );
  const rows = fixture(() => range(1, ROWS).map(row).join(''));
  const iterations = { warmup: 5, measured: 10 };
  const teardown = () => document.body.replaceChildren();

  let pending: DocumentFragment;

  return [
    {
      ...iterations,
      name: `${family}/create`,
      description: `${description} Times inserting ${ROWS.toLocaleString('en')} rows into the empty grid with one append().`,
      setup() {
        document.body.replaceChildren(page());
        pending = rows();
      },
      run: () => rowGroup().append(pending),
      teardown,
      verifySetup: () => verifyRows(0),
      verify: () => verifyRows(ROWS),
    },
    {
      ...iterations,
      name: `${family}/clear`,
      description:
        `${description} Starts with every row connected and times removing them all with replaceChildren().`,
      setup() {
        document.body.replaceChildren(page());
        rowGroup().append(rows());
      },
      run: () => rowGroup().replaceChildren(),
      teardown,
      verifySetup: () => verifyRows(ROWS),
      verify: () => verifyRows(0),
    },
  ];
}

export const watcherScalingScenarios: Scenario[] = [
  ...watcherScenarios(
    'watchers-few',
    FEW,
    'A grid whose rows carry four tokens each, with only the two selectors Impulse registers for itself watching the ' +
    'document.',
  ),
  ...watcherScenarios(
    'watchers-many',
    MANY,
    `A grid whose rows carry four tokens each, with ${MANY} never-matching lazyImport selectors registered on top of ` +
    'the two Impulse registers for itself.',
  ),
];
