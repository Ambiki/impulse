/**
 * One DOM workload timed on its own. A Scenario only touches the DOM through standard APIs and never imports Impulse,
 * so the same code runs on the Baseline, the Candidate, and the Control; the page decides which components exist.
 *
 * An Iteration calls `setup`, lets Impulse finish reacting, times `run` until the microtasks it queued have drained,
 * then calls `teardown`.
 */
export interface Scenario {
  /** `family/operation`, or just `family` when there is a single operation. */
  name: string;
  /** Iterations per Round discarded before measuring, so the JIT has seen the code. */
  warmup: number;
  /** Iterations per Round whose median becomes the Round's Sample. */
  measured: number;
  /** Untimed. Builds the state `run` starts from, inside `document.body`. */
  setup: () => void;
  /** Timed. The DOM operation itself. */
  run: () => void;
  /** Untimed. Leaves `document.body` empty. */
  teardown: () => void;
  /**
   * Inspects the page after `run` on a Variant that loads Impulse and returns what is wrong with it: components that
   * never started, targets or actions that are not wired. Empty when Impulse did the work the Scenario claims to time.
   */
  verify: () => string[];
  /**
   * Like `verify`, but inspects the state `setup` built, before `run`. For operations on existing components (removing
   * or moving them) this is what shows the timed work was not a no-op.
   */
  verifySetup?: () => string[];
}
