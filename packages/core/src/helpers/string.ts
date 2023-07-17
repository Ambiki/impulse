const STRING_CAMELIZE_REGEXP_1 = /(-|_|\.|\s)+(.)?/g;
const STRING_CAMELIZE_REGEXP_2 = /(^|\/)([A-Z])/g;
const STRING_DASHERIZE_REGEXP = /[ _]/g;
const STRING_DECAMELIZE_REGEXP = /([a-z\d])([A-Z])/g;

/**
 * Returns the lowerCamelCase form of a string.
 *
 * @example
 * camelize('innerHTML');
 * //=> innerHTML
 *
 * camelize('action_name');
 * //=> actionName
 *
 * camelize('css-class-name');
 * //=> cssClassName
 *
 * camelize('my favorite items');
 * //=> myFavoriteItems
 *
 * camelize('My Favorite Items');
 * //=> myFavoriteItems
 *
 * camelize('private-docs/owner-invoice');
 * //=> privateDocs/ownerInvoice
 */
export function camelize(value: string) {
  return value
    .replace(STRING_CAMELIZE_REGEXP_1, (_match, _separator, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(STRING_CAMELIZE_REGEXP_2, (match) => match.toLowerCase());
}

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

/**
 * Returns the output of JSON.parse or fallbacks to a specified default value.
 *
 * @example
 * parseJSON('[]');
 * //=> []
 *
 * parseJSON(undefined, '');
 * //=> ''
 */
export function parseJSON(value: string | null | undefined, fallback: unknown = '') {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
