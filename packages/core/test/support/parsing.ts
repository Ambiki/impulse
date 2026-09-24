/**
 * Makes the document report that it is still being parsed, as it does while a blocking `<head>` script runs. Returns a
 * function that finishes the parse: `readyState` reads the real value again and `DOMContentLoaded` is dispatched.
 * Calling it again is a no-op, so a test can finish the parse itself and still call it from `afterEach`.
 */
export function simulateParsing(): () => void {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' });

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    // The override is an own property shadowing `Document.prototype.readyState`.
    delete (document as { readyState?: DocumentReadyState }).readyState;
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
  };
}

/**
 * Moves a simulated parse on to `interactive`: the document is Parsed but `DOMContentLoaded` has not fired yet, the
 * window in which `defer` and module scripts run. Only call it between `simulateParsing()` and finishing the parse.
 */
export function simulateInteractive(): void {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'interactive' });
}
