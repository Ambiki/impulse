import type { PropertyConstructor } from '../decorators/property';

/**
 * Returns whether a converted attribute value is unchanged, and so must not fire `[property]Changed`.
 *
 * Primitives compare with `Object.is` so a Number that transforms to `NaN` on both sides (e.g. a non-numeric value
 * replaced with another) counts as unchanged. `Array` and `Object` cannot compare that way: `fromAttribute` parses a
 * fresh value on every call, so the two sides are never the same reference no matter what they hold. They compare
 * structurally instead, which also makes a reformatted but equal write (`{ "foo": "bar" }` to `{"foo":"bar"}`) the
 * no-op it reads as.
 *
 * @example
 * isUnchanged(['Guava'], ['Guava'], Array);
 * //=> true
 */
export function isUnchanged(newValue: unknown, oldValue: unknown, type: PropertyConstructor) {
  switch (type) {
    case Array:
    case Object:
      return isDeepEqual(newValue, oldValue);
    default:
      return Object.is(newValue, oldValue);
  }
}

/**
 * Structural comparison of two parsed JSON values. Both sides come out of `JSON.parse`, so there are no cycles, no
 * prototypes, and no wrapper types to account for — only objects, arrays, and primitives. Key order is not part of an
 * object's value, but element order is part of an array's. The comparison is symmetric, so the arguments are named
 * `left`/`right` rather than new/old: past the first level they are no longer either.
 */
function isDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => isDeepEqual(value, right[index]));
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) =>
      Object.hasOwn(right, key) &&
      isDeepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  );
}
