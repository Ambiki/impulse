import type { Scenario } from './scenario.ts';
import { expectEqual, fixture, range, STARTED_ATTRIBUTE, startedCount } from './fixtures.ts';

const ROWS = 5_000;
const APPENDED_ROWS = 1_000;

/**
 * One way of giving 5,000 rows behavior. Each row is 8 elements carrying 4 tokens: `select` and `navigate` actions on
 * the row, and label and delete-button targets inside it. A `<table>` cannot hold custom elements as rows (the parser
 * foster-parents them out), so both shapes use ARIA grid roles on `<div>`s.
 */
interface Shape {
  family: string;
  grid: () => DocumentFragment;
  row: (id: number) => string;
  /** Problems with the rows now in the grid, which should be exactly `ids`, in that order. */
  verifyRows: (ids: number[]) => string[];
  /** Problems with rows that were in the grid and have been removed. */
  verifyRemoved: (rows: HTMLElement[]) => string[];
}

interface DataTable extends HTMLElement {
  labels: HTMLElement[];
  deleteButtons: HTMLElement[];
  selectedId: string | null;
}

interface TableRow extends HTMLElement {
  label: HTMLElement | null;
  deleteButton: HTMLElement | null;
  selected: boolean;
}

function cells(id: number, labelTarget: string, deleteTarget: string): string {
  return (
    `<div role="gridcell">${id}</div>` +
    `<div role="gridcell"><span data-target="${labelTarget}">Row ${id}</span></div>` +
    `<div role="gridcell">Team ${id % 7}</div>` +
    `<div role="gridcell">${(id * 37) % 100}%</div>` +
    `<div role="gridcell"><button type="button" data-target="${deleteTarget}">Delete</button></div>`
  );
}

function rowGroup(): HTMLElement {
  return document.querySelector('[role="rowgroup"]')!;
}

function rowWithId(id: number): HTMLElement {
  return rowGroup().querySelector<HTMLElement>(`[data-id="${id}"]`)!;
}

// A row whose id is not a multiple of 10, so it starts unselected.
function unselectedId(ids: number[]): number {
  return ids.find((id, index) => index >= ids.length / 2 && id % 10 !== 0)!;
}

/** One `<data-table>` owns every row's tokens: 20,000 tokens routed to a single component. */
const singleOwner: Shape = {
  family: 'table-single-owner',
  grid: fixture(() => `<data-table role="grid"><div role="rowgroup"></div></data-table>`),
  row: (id) =>
    `<div role="row" data-id="${id}" data-action="click->data-table#select keydown->data-table#navigate">` +
    `${cells(id, 'data-table.labels', 'data-table.deleteButtons')}</div>`,
  verifyRows(ids) {
    const problems: string[] = [];
    const table = document.querySelector('data-table') as DataTable;
    expectEqual(problems, '<data-table> started', table.hasAttribute(STARTED_ATTRIBUTE), true);
    expectEqual(problems, 'labels', table.labels.length, ids.length);
    expectEqual(problems, 'deleteButtons', table.deleteButtons.length, ids.length);
    expectEqual(problems, 'first label', table.labels[0]?.textContent, `Row ${ids[0]}`);
    expectEqual(problems, 'last label', table.labels.at(-1)?.textContent, `Row ${ids.at(-1)}`);
    const id = unselectedId(ids);
    rowWithId(id).click();
    expectEqual(problems, `selectedId after clicking row ${id}`, table.selectedId, String(id));
    return problems;
  },
  verifyRemoved(rows) {
    const problems: string[] = [];
    const table = document.querySelector('data-table') as DataTable;
    expectEqual(problems, 'labels', table.labels.length, 0);
    expectEqual(problems, 'deleteButtons', table.deleteButtons.length, 0);
    // Row 1, which `verifySetup` did not click, so a listener left attached would change `selectedId`.
    const selectedId = table.selectedId;
    rows[0].click();
    expectEqual(problems, 'selectedId after clicking a removed row', table.selectedId, selectedId);
    return problems;
  },
};

/** Every row is its own `<table-row>` component: 5,000 components each starting a property, targets and actions. */
const rowElements: Shape = {
  family: 'table-row-elements',
  grid: fixture(() => `<div role="grid"><div role="rowgroup"></div></div>`),
  row: (id) =>
    `<table-row role="row" data-id="${id}"${id % 10 === 0 ? ' selected' : ''} ` +
    `data-action="click->table-row#select keydown->table-row#navigate">` +
    `${cells(id, 'table-row.label', 'table-row.deleteButton')}</table-row>`,
  verifyRows(ids) {
    const problems: string[] = [];
    const rows = Array.from(rowGroup().querySelectorAll<TableRow>('table-row'));
    expectEqual(problems, 'rows', rows.length, ids.length);
    expectEqual(problems, 'first row', rows[0]?.dataset.id, String(ids[0]));
    expectEqual(problems, 'last row', rows.at(-1)?.dataset.id, String(ids.at(-1)));
    expectEqual(problems, 'rows not started', rows.length - startedCount(rows), 0);
    expectEqual(problems, 'rows without a label', rows.filter((row) => !row.label).length, 0);
    expectEqual(problems, 'rows without a delete button', rows.filter((row) => !row.deleteButton).length, 0);
    expectEqual(problems, 'row 10 selected from markup', (rowWithId(10) as TableRow).selected, true);
    const row = rowWithId(unselectedId(ids)) as TableRow;
    row.click();
    expectEqual(problems, `row ${row.dataset.id} selected after a click`, row.selected, true);
    return problems;
  },
  verifyRemoved(rows) {
    const problems: string[] = [];
    const removed = rows as TableRow[];
    expectEqual(problems, 'removed rows still started', startedCount(removed), 0);
    expectEqual(problems, 'removed rows still holding a label', removed.filter((row) => row.label).length, 0);
    const row = removed.find((candidate) => !candidate.hasAttribute('selected'))!;
    row.click();
    expectEqual(problems, 'removed row selected after a click', row.hasAttribute('selected'), false);
    return problems;
  },
};

function operations(shape: Shape): Scenario[] {
  const rows = fixture(() => range(1, ROWS).map(shape.row).join(''));
  const appendedRows = fixture(() => range(ROWS + 1, ROWS + APPENDED_ROWS).map(shape.row).join(''));
  const iterations = { warmup: 5, measured: 10 };
  const teardown = () => document.body.replaceChildren();

  let pending: DocumentFragment;
  let removed: HTMLElement[];

  const insertRows = () => {
    document.body.replaceChildren(shape.grid());
    rowGroup().append(rows());
  };

  return [
    {
      name: `${shape.family}/create`,
      ...iterations,
      setup() {
        document.body.replaceChildren(shape.grid());
        pending = rows();
      },
      run: () => rowGroup().append(pending),
      teardown,
      verify: () => shape.verifyRows(range(1, ROWS)),
    },
    {
      name: `${shape.family}/clear`,
      ...iterations,
      setup() {
        insertRows();
        removed = Array.from(rowGroup().children as HTMLCollectionOf<HTMLElement>);
      },
      run: () => rowGroup().replaceChildren(),
      teardown,
      verifySetup: () => shape.verifyRows(range(1, ROWS)),
      verify: () => shape.verifyRemoved(removed),
    },
    {
      name: `${shape.family}/append`,
      ...iterations,
      setup() {
        insertRows();
        pending = appendedRows();
      },
      run: () => rowGroup().append(pending),
      teardown,
      verifySetup: () => shape.verifyRows(range(1, ROWS)),
      verify: () => shape.verifyRows(range(1, ROWS + APPENDED_ROWS)),
    },
    {
      // Re-appending the rows in reverse detaches and reattaches every one of them in the same task.
      name: `${shape.family}/move`,
      ...iterations,
      setup: insertRows,
      run: () => rowGroup().append(...Array.from(rowGroup().children).reverse()),
      teardown,
      verifySetup: () => shape.verifyRows(range(1, ROWS)),
      verify: () => shape.verifyRows(range(1, ROWS).reverse()),
    },
  ];
}

export const tableScenarios: Scenario[] = [...operations(singleOwner), ...operations(rowElements)];
