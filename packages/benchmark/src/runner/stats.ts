export type Verdict = 'faster' | 'slower' | 'no change' | 'unsure';

/** Changes smaller than this fraction of the Baseline are treated as noise rather than a speedup or regression. */
export const NO_CHANGE_BAND = 0.02;

export interface Difference {
  /** `subject`'s mean minus `reference`'s mean, as a fraction of `reference`'s mean (`-0.05` is 5% faster). */
  delta: number;
  /** The 95% Welch confidence interval on `delta`, in the same units. */
  interval: [number, number];
}

export interface Comparison extends Difference {
  verdict: Verdict;
}

/** The Candidate's Samples against the Baseline's, with the Verdict. */
export function compare(baseline: number[], candidate: number[]): Comparison {
  const difference = relativeDifference(baseline, candidate);
  return { ...difference, verdict: verdictFor(difference.interval) };
}

/**
 * Welch's t-interval on the difference of means, which does not assume equal variances, scaled by `reference`'s
 * mean. The scaling ignores the uncertainty in that mean, which only stretches or shrinks the interval by a factor of
 * about (1 ± CV / √n): a few percent of its width for Scenarios whose Samples vary by a few percent.
 */
export function relativeDifference(reference: number[], subject: number[]): Difference {
  const r = sampleStatistics(reference);
  const s = sampleStatistics(subject);

  const rTerm = r.variance / r.count;
  const sTerm = s.variance / s.count;
  const standardError = Math.sqrt(rTerm + sTerm);
  const degreesOfFreedom = (rTerm + sTerm) ** 2 / (rTerm ** 2 / (r.count - 1) + sTerm ** 2 / (s.count - 1));
  // With no spread in either set the degrees of freedom are 0 / 0 and the difference is exact.
  const margin = standardError === 0 ? 0 : studentTQuantile(0.975, degreesOfFreedom) * standardError;

  const difference = s.mean - r.mean;
  return {
    delta: difference / r.mean,
    interval: [(difference - margin) / r.mean, (difference + margin) / r.mean],
  };
}

function verdictFor([low, high]: [number, number]): Verdict {
  if (low >= -NO_CHANGE_BAND && high <= NO_CHANGE_BAND) return 'no change';
  if (high < 0) return 'faster';
  if (low > 0) return 'slower';
  return 'unsure';
}

export function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The middle value, or the mean of the two middle values. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function sampleStatistics(samples: number[]) {
  const count = samples.length;
  if (count < 2) throw new Error(`Comparing Variants needs at least 2 Samples each, got ${count}.`);
  const average = mean(samples);
  const variance = samples.reduce((sum, value) => sum + (value - average) ** 2, 0) / (count - 1);
  return { count, mean: average, variance };
}

/**
 * The `p` quantile (p > 0.5) of Student's t distribution, found by bisecting its CDF.
 */
function studentTQuantile(p: number, degreesOfFreedom: number): number {
  let low = 0;
  let high = 1;
  while (studentTCdf(high, degreesOfFreedom) < p) high *= 2;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (studentTCdf(mid, degreesOfFreedom) < p) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

// For t >= 0: P(T <= t) = 1 - I_x(v / 2, 1 / 2) / 2, where x = v / (v + t^2).
function studentTCdf(t: number, degreesOfFreedom: number): number {
  const x = degreesOfFreedom / (degreesOfFreedom + t * t);
  return 1 - regularizedIncompleteBeta(x, degreesOfFreedom / 2, 0.5) / 2;
}

// Numerical Recipes (3rd ed.) §6.4: the continued fraction converges quickly for x < (a + 1) / (a + b + 2); use the
// symmetry I_x(a, b) = 1 - I_{1-x}(b, a) otherwise.
function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(x, a, b)) / a;
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

// Modified Lentz's method.
function betaContinuedFraction(x: number, a: number, b: number): number {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let result = d;
  for (let m = 1; m <= 300; m++) {
    const even = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + even * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + even / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    result *= d * c;

    const odd = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + odd * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + odd / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const step = d * c;
    result *= step;
    if (Math.abs(step - 1) < 1e-15) break;
  }
  return result;
}

// Lanczos approximation (g = 7, n = 9).
const LANCZOS = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  const shifted = z - 1;
  let sum = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) sum += LANCZOS[i] / (shifted + i);
  const t = shifted + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum);
}
