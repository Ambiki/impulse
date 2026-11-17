// Whether `cleanup()` was registered with the runner's `afterEach` when the entry point was imported, and whether a test
// has been warned that it was not.
let registered = false;
let warned = false;

/** The runner's `afterEach`, when it has one as a global: Mocha, Jest, and Vitest with `globals` do. */
function afterEachHook(): ((callback: () => void) => unknown) | undefined {
  const hook: unknown = (globalThis as { afterEach?: unknown }).afterEach;
  return typeof hook === 'function' ? (hook as (callback: () => void) => unknown) : undefined;
}

/** Registers `cleanup` to run after each test, with a runner that has `afterEach` as a global. */
export function registerCleanup(cleanup: () => void): void {
  const hook = afterEachHook();
  if (!hook) return;
  hook(cleanup);
  registered = true;
}

/**
 * Warns, once, when the runner has an `afterEach` that `cleanup()` was not registered with: the entry point was
 * imported before the runner defined it, as a Jest `setupFiles` script imports it, so every Fixture would outlive its
 * test without a word. Called by whatever a `cleanup()` would have to undo.
 *
 * A runner with no `afterEach` global at all is not warned: there `afterEach(cleanup)` is the test suite's to call.
 */
export function warnUnlessCleanupRegistered(): void {
  if (registered || warned || !afterEachHook()) return;
  warned = true;
  console.warn(
    '[impulse] @ambiki/impulse/testing was imported before the test runner defined afterEach (from Jest\'s ' +
    'setupFiles, say), so cleanup() does not run after each test. Import it from a test file or from ' +
    'setupFilesAfterEnv instead, or call afterEach(cleanup) yourself.',
  );
}
