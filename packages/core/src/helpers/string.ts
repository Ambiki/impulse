const STRING_DASHERIZE_REGEXP = /[ _]/g;
const STRING_DECAMELIZE_REGEXP = /([a-z\d])([A-Z])/g;

/**
 * Replaces underscores, spaces, or camelCase with dashes.
 *
 * @example
 * dasherize('innerHTML');
 * //=> inner-html
 *
 * dasherize('action_name');
 * //=> action-name
 */
export function dasherize(value: string): string {
  return decamelize(value).replace(STRING_DASHERIZE_REGEXP, '-');
}

/**
 * Converts a camelized string into all lower case separated by underscores.
 *
 * @example
 * decamelize('innerHTML');
 * //=> inner_html
 */
export function decamelize(value: string): string {
  return value.replace(STRING_DECAMELIZE_REGEXP, '$1_$2').toLowerCase();
}
