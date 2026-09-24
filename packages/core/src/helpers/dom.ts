/**
 * Returns a promise that is fulfilled once the document is Parsed: on `DOMContentLoaded` while `readyState` is
 * `loading`, and on the next microtask after that.
 */
export function whenParsed() {
  return new Promise<void>((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    } else {
      resolve();
    }
  });
}
