import type { Scenario } from './scenario.ts';
import { expectEqual, fixture, STARTED_ATTRIBUTE } from './fixtures.ts';

const READS = 10_000;

interface TableRow extends HTMLElement {
  label?: HTMLElement | null;
}

function row(): TableRow {
  return document.querySelector('table-row') as TableRow;
}

const page = fixture(
  () =>
    `<div role="grid"><table-row role="row"><div role="gridcell">` +
    `<span data-target="table-row.label">Row 1</span></div></table-row></div>`,
);

// Counted in `run` and checked in `verify`, so the reads cannot be optimized away.
let found = 0;

/**
 * Reads a `@target()` field over and over on a page where nothing has changed, so every read finds no DOM change
 * waiting to be delivered: what any read of a target field costs. A `@target()` field rather than a `@targets()` one,
 * whose first read after a change sorts every target, which on a large page would outweigh the reads themselves.
 */
export const targetReads: Scenario = {
  name: 'target-reads',
  description:
    `A <table-row> component with a label target, and no DOM change waiting. Times reading its @target() field ` +
    `${READS.toLocaleString('en')} times.`,
  warmup: 5,
  measured: 10,
  setup() {
    document.body.replaceChildren(page());
  },
  run() {
    const element = row();
    found = 0;
    // The Control defines no component, so the field is missing there and the loop only reads `undefined`.
    for (let read = 0; read < READS; read += 1) {
      if (element.label) found += 1;
    }
  },
  teardown() {
    document.body.replaceChildren();
  },
  verify() {
    const problems: string[] = [];
    expectEqual(problems, '<table-row> initialized', row().hasAttribute(STARTED_ATTRIBUTE), true);
    expectEqual(problems, 'reads that found the label', found, READS);
    return problems;
  },
};
