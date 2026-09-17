import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compare } from '../src/runner/stats.ts';

// Expected values come from SciPy 1.15 (`scipy.stats.ttest_ind(candidate, baseline, equal_var=False)` and its
// `confidence_interval(0.95)`), divided by the Baseline mean.
function assertClose(actual: number, expected: number, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

describe('compare', () => {
  it('reports the change relative to the Baseline mean with a 95% Welch interval', () => {
    const result = compare([20.0, 24.0, 19.0, 25.0], [21.0, 21.5, 20.5, 22.0, 21.0, 21.5]);

    assertClose(result.delta, -0.03409090909090909);
    assertClose(result.interval[0], -0.24438443799074483);
    assertClose(result.interval[1], 0.17620261980892665);
  });

  it('is faster when the whole interval is below zero and reaches past the no-change band', () => {
    // Interval [-10.04%, -5.80%].
    const result = compare(
      [10.1, 10.3, 9.9, 10.2, 10.0, 10.4, 9.8, 10.1],
      [9.2, 9.5, 9.1, 9.4, 9.3, 9.6, 9.0, 9.3],
    );

    assert.equal(result.verdict, 'faster');
  });

  it('is slower when the whole interval is above zero and reaches past the no-change band', () => {
    // Interval [+2.54%, +3.46%].
    const result = compare([50.0, 50.2, 49.8, 50.1, 49.9], [51.5, 51.7, 51.3, 51.6, 51.4]);

    assert.equal(result.verdict, 'slower');
  });

  it('is no change when the whole interval sits inside ±2%, even if it excludes zero', () => {
    // Interval [-1.46%, -0.54%].
    const result = compare([50.0, 50.2, 49.8, 50.1, 49.9], [49.5, 49.7, 49.3, 49.6, 49.4]);

    assert.equal(result.verdict, 'no change');
  });

  it('is unsure when the interval crosses zero and reaches outside ±2%', () => {
    // Interval [-6.61%, +1.41%].
    const result = compare([10.0, 10.4, 9.6, 10.2, 9.8], [9.7, 10.0, 9.5, 9.9, 9.6]);

    assert.equal(result.verdict, 'unsure');
  });

  it('gives a zero-width interval when neither Variant varies', () => {
    // Samples can tie exactly when a Scenario is shorter than the timer resolution.
    const result = compare([2.005, 2.005, 2.005], [1.905, 1.905, 1.905]);

    assertClose(result.delta, -0.04987531172069826);
    assert.deepEqual(result.interval, [result.delta, result.delta]);
    assert.equal(result.verdict, 'faster');
  });

  it('rejects a Variant with fewer than two Samples', () => {
    assert.throws(() => compare([10.0], [9.0, 9.1]), /at least 2 Samples/);
  });
});
