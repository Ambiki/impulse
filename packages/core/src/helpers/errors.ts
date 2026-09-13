/**
 * Surfaces an error thrown by user code (a watcher callback, a lifecycle hook) without letting it unwind the caller.
 * Uses `reportError` where available, which dispatches a window `error` event exactly like an uncaught exception, and
 * falls back to rethrowing from a fresh task.
 */
export function reportUncaught(error: unknown): void {
  if (typeof reportError === 'function') {
    reportError(error);
    return;
  }
  setTimeout(() => {
    throw error;
  });
}

/**
 * Runs `callback` and reports anything it throws via {@link reportUncaught}. Use it around user callbacks whose failure
 * must not stop the caller from finishing its own work; every error is reported, none is swallowed or rethrown.
 */
export function invokeReporting(callback: () => void): void {
  try {
    callback();
  } catch (error) {
    reportUncaught(error);
  }
}
