/**
 * Returns the attribute's value as an array.
 * @example
 * <div data-action="foo bar"></div>
 *
 * const element = document.querySelector('div');
 * getAttributeValues(element, 'data-action');
 * //=> ['foo', 'bar']
 *
 *
 * <div data-action="foo bar"></div>
 *
 * const element = document.querySelector('div');
 * getAttributeValues(element, 'invalid');
 * //=> []
 */
export function getAttributeValues(target: Element, attributeName: string): string[] {
  return target.getAttribute(attributeName)?.trim().split(/\s+/) || [];
}

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
