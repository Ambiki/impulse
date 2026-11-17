import { registerCleanup } from './auto_cleanup';
import { removeFixtures } from './fixture';
import { stopRecordings } from './record_events';

export { fixture } from './fixture';
export { recordEvents } from './record_events';
export type { Recording } from './record_events';
export { whenSettled } from './when_settled';

/**
 * Stops every Recording, then removes every Fixture. It runs after each test on its own with a runner that has
 * `afterEach` as a global, which Mocha, Jest, and Vitest with `globals` do. It is registered as this entry point is
 * imported, so import it once the runner has defined `afterEach`. With any other runner, call `afterEach(cleanup)` once.
 *
 * An element a test's code appends anywhere else is the test's to remove.
 */
export function cleanup(): void {
  stopRecordings();
  removeFixtures();
}

registerCleanup(cleanup);
