/**
 * Calls `fn` for every item. Every item is visited even if an earlier call throws, so teardown paths cannot be left
 * half-done; the first error is rethrown once the loop has finished.
 */
export function invokeEach<T>(items: Iterable<T>, fn: (item: T) => void): void {
  let failed = false;
  let firstError: unknown;
  for (const item of items) {
    try {
      fn(item);
    } catch (error) {
      if (!failed) {
        failed = true;
        firstError = error;
      }
    }
  }
  if (failed) throw firstError;
}
