import { removeFixtures } from './fixture';

export { fixture } from './fixture';
export { whenSettled } from './when_settled';

/**
 * Removes every Fixture. It runs after each test on its own when the runner has `afterEach` as a global, which Mocha,
 * Jest, and Vitest with `globals` do. With any other runner, call `afterEach(cleanup)` once.
 *
 * An element a test's code appends anywhere else is the test's to remove.
 */
export function cleanup(): void {
  removeFixtures();
}

const afterEachHook: unknown = (globalThis as { afterEach?: unknown }).afterEach;
if (typeof afterEachHook === 'function') afterEachHook(cleanup);
