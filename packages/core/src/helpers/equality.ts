/**
 * Structural comparison of two parsed JSON values. Both sides come out of `JSON.parse`, so there are no cycles, no
 * prototypes, and no wrapper types to account for — only objects, arrays, and primitives. Primitives compare with
 * `Object.is`, so `NaN` equals itself. Key order is not part of an object's value, but element order is part of an
 * array's. The comparison is symmetric, so the arguments are named `left`/`right` rather than new/old: past the first
 * level they are no longer either.
 */
export function isDeepEqual(left: unknown, right: unknown): boolean {
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
