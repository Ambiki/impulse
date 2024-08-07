export default class SetMap<K, V> {
  private map = new Map<K, Set<V>>();

  add(key: K, value: V) {
    findOrCreate(this.map, key).add(value);
  }

  delete(key: K, value: V) {
    findOrCreate(this.map, key).delete(value);
    // Delete map item
    if (this.get(key)?.size === 0) {
      this.deleteKey(key);
    }
  }

  deleteKey(key: K) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  getValuesForKey(key: K): V[] {
    const values = this.map.get(key);
    return values ? Array.from(values) : [];
  }

  get keys() {
    return Array.from(this.map.keys());
  }

  get values(): V[] {
    const sets = Array.from(this.map.values());
    return sets.reduce((values, set) => values.concat(Array.from(set)), <V[]>[]);
  }

  get(key: K): Set<V> | undefined {
    return this.map.get(key);
  }

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
