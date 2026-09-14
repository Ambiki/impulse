/**
 * A `Map` whose values are `Set`s, so a key holds many values without a caller ever having to create the inner set or
 * clean it up. Deleting a key's last value through {@link SetMap.delete} drops the key with it, so a long-lived map
 * does not accumulate one entry per key it has ever seen. Emptying the live set from {@link SetMap.get} is the one way
 * to leave a key behind with nothing in it.
 */
export default class SetMap<K, V> {
  private map = new Map<K, Set<V>>();

  /**
   * Adds `value` under `key`, creating the set on first use.
   */
  add(key: K, value: V) {
    findOrCreate(this.map, key).add(value);
  }

  /**
   * Removes `value` from `key`, dropping the key itself when that was its last value.
   */
  delete(key: K, value: V) {
    findOrCreate(this.map, key).delete(value);
    // Delete map item
    if (this.get(key)?.size === 0) {
      this.deleteKey(key);
    }
  }

  /**
   * Drops the key and every value under it at once.
   */
  deleteKey(key: K) {
    this.map.delete(key);
  }

  /**
   * Empties the map.
   */
  clear() {
    this.map.clear();
  }

  /**
   * The values under `key` as an array, empty when the key is absent. A snapshot, so it is safe to iterate while
   * deleting from the map - unlike the live set {@link SetMap.get} returns.
   */
  getValuesForKey(key: K): V[] {
    const values = this.map.get(key);
    return values ? Array.from(values) : [];
  }

  /**
   * Every key the map is holding. A key emptied through {@link SetMap.get} stays until it is deleted.
   */
  get keys() {
    return Array.from(this.map.keys());
  }

  /**
   * Every value across every key, flattened in insertion order. Values are not deduplicated across keys.
   */
  get values(): V[] {
    const sets = Array.from(this.map.values());
    return sets.reduce((values, set) => values.concat(Array.from(set)), <V[]>[]);
  }

  /**
   * The live set backing `key`, or `undefined` when the key is absent. Mutating it bypasses the empty-key cleanup that
   * {@link SetMap.delete} does, so prefer the methods above unless you need the set itself.
   */
  get(key: K): Set<V> | undefined {
    return this.map.get(key);
  }

  /**
   * Whether `value` is stored under `key`.
   */
  has(key: K, value: V): boolean {
    return !!this.get(key)?.has(value);
  }
}

function findOrCreate<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  let values = map.get(key);
  if (!values) {
    values = new Set();
    map.set(key, values);
  }

  return values;
}
