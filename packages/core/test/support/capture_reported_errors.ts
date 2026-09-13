/**
 * Errors raised inside custom element reactions and watcher callbacks are reported to `window.onerror` instead of
 * propagating to the caller. Mocha treats those as test failures, so tests that expect one swap the handler out for the
 * duration of the test and restore it in `finally`. Only errors whose message includes `message` are captured; anything
 * else still reaches the previous handler.
 */
export function captureReportedErrors(message: string) {
  const reported: Error[] = [];
  const previous = window.onerror;
  window.onerror = (event, source, lineno, colno, error) => {
    if (error instanceof Error && error.message.includes(message)) {
      reported.push(error);
      return true;
    }
    return previous?.call(window, event, source, lineno, colno, error) ?? false;
  };
  const release = () => {
    window.onerror = previous;
  };
  return { reported, release };
}
