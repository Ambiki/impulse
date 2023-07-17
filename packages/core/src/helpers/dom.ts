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
