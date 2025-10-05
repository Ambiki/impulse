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

/**
 * Returns all descendant elements matching the selector, including the root element if it matches.
 *
 * @param element - The root element to search from
 * @param selector - CSS selector to match against
 * @returns Array of matching elements, with the root element first if it matches the selector
 *
 * @example
 * ```ts
 * const container = document.querySelector('.container');
 * const buttons = getMatchingElementsFrom(container, 'button');
 * ```
 */
export function getMatchingElementsFrom<T extends Element>(element: T, selector: string): T[] {
  const elements = Array.from(element.querySelectorAll<T>(selector));
  if (element.matches(selector)) {
    elements.unshift(element);
  }
  return elements;
}
