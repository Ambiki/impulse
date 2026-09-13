/**
 * Errors raised inside custom element reactions and watcher callbacks are reported to `window.onerror` instead of
 * propagating to the caller. Mocha treats those as test failures, so tests that expect one swap the handler out for the
 * duration of the test and restore it in `finally`. Only errors whose message includes `message` are captured; anything
 * else still reaches the previous handler.
 *
 * `@web/browser-logs` also listens for `error` events and funnels each one into `console.error`, which the test runner
 * prints under "Browser logs". Canceling the event does not stop that listener — it only suppresses the browser's own
 * console report — so `console.error` is swapped out too. It drops only that listener's shape of call, a lone claimed
 * error and nothing alongside it, so a log that carries its own context still reaches the console intact.
 */
export function captureReportedErrors(message: string) {
  const reported: Error[] = [];
  const previousOnError = window.onerror;
  window.onerror = (event, source, lineno, colno, error) => {
    if (error instanceof Error && error.message.includes(message)) {
      reported.push(error);
      return true;
    }
    return previousOnError?.call(window, event, source, lineno, colno, error) ?? false;
  };

  const previousConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const [error] = args;
    if (args.length === 1 && error instanceof Error && error.message.includes(message)) return;
    previousConsoleError.apply(console, args);
  };

  const release = () => {
    window.onerror = previousOnError;
    console.error = previousConsoleError;
  };
  return { reported, release };
}
