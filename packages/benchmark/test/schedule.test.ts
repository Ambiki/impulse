import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { schedule } from '../src/runner/schedule.ts';

describe('schedule', () => {
  it('reverses the Variant order on every other sweep', () => {
    assert.deepEqual(schedule(['baseline', 'candidate', 'control'], 2), [
      'baseline',
      'candidate',
      'control',
      'control',
      'candidate',
      'baseline',
    ]);
  });

  it('gives every Variant `rounds` Rounds, including an odd number of them', () => {
    assert.deepEqual(schedule(['baseline', 'candidate'], 3), [
      'baseline',
      'candidate',
      'candidate',
      'baseline',
      'baseline',
      'candidate',
    ]);
  });
});
