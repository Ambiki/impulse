// The timers every wait uses, captured when the module is imported. A test that installs fake timers afterwards swaps
// out `setTimeout` on the global, which would otherwise stop a wait from ever yielding or reaching its deadline.
const setTimer = globalThis.setTimeout.bind(globalThis);
const clearTimer = globalThis.clearTimeout.bind(globalThis);

/** How long a wait gives up after, in milliseconds, unless it is given a `timeout`. */
export const DEFAULT_TIMEOUT = 1000;

/**
 * Resolves in a later task, so every microtask queued before it has run by then. Impulse delivers changes and
 * initializes elements in microtasks, so whatever it had pending when this is called has run too. A task rather than a
 * `MessageChannel` message, which jsdom does not have.
 */
export function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimer(resolve, 0);
  });
}

export interface Deadline {
  /** Whether the deadline has passed. */
  readonly passed: boolean;
  /** Stops the timer. */
  clear: () => void;
}

/**
 * Starts a deadline that passes after `timeout` milliseconds, calling `onPass` when it does. One that is not finite
 * never passes.
 */
export function startDeadline(timeout: number, onPass?: () => void): Deadline {
  let passed = false;
  const pass = () => {
    passed = true;
    onPass?.();
  };
  const timer = Number.isFinite(timeout) ? setTimer(pass, timeout) : undefined;
  return {
    get passed() {
      return passed;
    },
    clear: () => clearTimer(timer),
  };
}
