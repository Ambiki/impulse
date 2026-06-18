/**
 * Returns a promise that is fulfilled when the document's `readyState` is `complete`.
 */
export function domReady() {
  return new Promise<void>((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve());
    } else {
      resolve();
    }
  });
}
