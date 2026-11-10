import { waitUntil } from '@open-wc/testing';

// What `@web/browser-logs` logs, ahead of the error itself, for a promise that rejects with nobody handling it.
const OUTSIDE_A_TEST = 'An error was thrown in a Promise outside a test';

/**
 * A promise that rejects with nobody handling it, such as an element's init when one of its Steps or its `connected()`
 * throws, fires an `unhandledrejection` event. `@web/browser-logs` catches the promise from that event and logs a line
 * saying an error was thrown outside a test, then the error, which the test runner prints under "Browser logs". Tests
 * that expect such a rejection capture it, `await caught()`, and release in `finally`. The event comes in a task of its
 * own, sometimes more than a frame after the rejection, so waiting a frame is not enough; once it has come, the runner's
 * logging of it has run too. Only rejections whose error message includes `message` are captured; the line logged ahead
 * of one is held until the error that follows shows whether it is captured, so anything else still reaches the console
 * as it was logged.
 */
export function captureUnhandledRejections(message: string) {
  const rejected: Error[] = [];
  const claims = (reason: unknown): reason is Error => reason instanceof Error && reason.message.includes(message);

  const onRejection = (event: PromiseRejectionEvent) => {
    if (!claims(event.reason)) return;
    rejected.push(event.reason);
    event.preventDefault();
  };
  window.addEventListener('unhandledrejection', onRejection);

  const previousConsoleError = console.error;
  let heldLine: unknown[] | null = null;
  const flushHeldLine = () => {
    if (heldLine) previousConsoleError.apply(console, heldLine);
    heldLine = null;
  };
  console.error = (...args: unknown[]) => {
    const [first] = args;
    if (args.length === 1 && typeof first === 'string' && first.startsWith(OUTSIDE_A_TEST)) {
      flushHeldLine();
      heldLine = args;
      return;
    }
    if (args.length === 1 && claims(first)) {
      heldLine = null;
      return;
    }
    flushHeldLine();
    previousConsoleError.apply(console, args);
  };

  const release = () => {
    flushHeldLine();
    window.removeEventListener('unhandledrejection', onRejection);
    console.error = previousConsoleError;
  };
  /** Resolves once `count` rejections have been captured, and rejects if they do not come within a second. */
  const caught = (count = 1) =>
    waitUntil(() => rejected.length >= count, `expected ${count} unhandled rejection(s) with "${message}"`);
  return { rejected, caught, release };
}
