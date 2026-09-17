import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseArgs, UsageError } from '../src/runner/args.ts';

const SCENARIOS = [
  'table-single-owner/create',
  'table-single-owner/clear',
  'table-row-elements/create',
  'table-row-elements/clear',
  'body-swap',
  'attributes-plain',
  'attributes-tokened',
];

describe('parseArgs', () => {
  it('compares against main over 10 Rounds of every Scenario by default', () => {
    assert.deepEqual(parseArgs([], SCENARIOS), {
      baseline: 'main',
      rounds: 10,
      scenarios: SCENARIOS,
      json: undefined,
      help: false,
    });
  });

  it('narrows the Scenarios to those matching any --scenario glob, keeping registry order', () => {
    const { scenarios } = parseArgs(['--scenario', 'attributes-*', '--scenario', 'table-*/clear'], SCENARIOS);

    assert.deepEqual(scenarios, [
      'table-single-owner/clear',
      'table-row-elements/clear',
      'attributes-plain',
      'attributes-tokened',
    ]);
  });

  it('rejects a --scenario glob that matches nothing and lists the Scenarios that exist', () => {
    assert.throws(
      () => parseArgs(['--scenario', 'table-*', '--scenario', 'tabel-*'], SCENARIOS),
      (error: Error) => {
        assert.match(error.message, /"tabel-\*" matches no Scenario/);
        assert.match(error.message, /attributes-tokened/);
        return true;
      },
    );
  });

  it('rejects --rounds that is not a whole number of at least 2', () => {
    for (const rounds of ['1', '2.5', 'ten', '']) {
      assert.throws(() => parseArgs(['--rounds', rounds], SCENARIOS), /--rounds must be a whole number of at least 2/);
    }
    assert.equal(parseArgs(['--rounds', '2'], SCENARIOS).rounds, 2);
  });

  it('reports an unknown option as a usage error', () => {
    assert.throws(() => parseArgs(['--round', '5'], SCENARIOS), (error: Error) => {
      assert.ok(error instanceof UsageError);
      assert.match(error.message, /--round/);
      return true;
    });
  });
});
