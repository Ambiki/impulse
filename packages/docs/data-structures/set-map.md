# SetMap

`SetMap` is a `Map` whose values are `Set`s, so one key holds many values without you ever creating the inner set or
cleaning it up.

## Usage

```ts
import { SetMap } from '@ambiki/impulse';

const handlers = new SetMap<string, () => void>();

handlers.add('click', onClick);
handlers.add('click', onClickAgain);
handlers.add('focus', onFocus);

handlers.valuesForKey('click'); // [onClick, onClickAgain]
handlers.has('click', onClick); // true
handlers.keys; // ['click', 'focus']
handlers.values; // [onClick, onClickAgain, onFocus]
```

`add()` returns the map, so calls chain:

```ts
handlers.add('click', onClick).add('click', onClickAgain).add('focus', onFocus);
```

`values` flattens every key's values into one array, in insertion order. Values are not deduplicated across keys, so
something stored under two keys appears twice.

## Keys come and go with their values

A key exists only while it holds at least one value. Deleting the last value under a key drops the key with it, so a
long-lived map does not accumulate an entry for every key it has ever seen.

```ts
handlers.delete('focus', onFocus);

handlers.keys; // ['click']
handlers.get('focus'); // undefined
```

`delete()` reports whether it removed anything, the way `Set.prototype.delete` does. It returns `false` — and leaves the
map untouched — when the key is absent or does not hold that value:

```ts
handlers.delete('click', onClick); // true
handlers.delete('click', onClick); // false — already gone
handlers.delete('keydown', onKeydown); // false — no such key
```

`deleteKey()` drops a key and everything under it in one go, returning whether the key was there, and `clear()` empties
the map.

## Snapshots and the live set

`valuesForKey()` returns a new array, empty when the key is absent. Because it is a snapshot rather than the set itself,
it is safe to iterate while deleting from the map.

```ts
for (const handler of handlers.valuesForKey('click')) {
  handlers.delete('click', handler);
}

handlers.keys; // []
```

`get()` returns the live `Set` instead, or `undefined` when the key is absent. Mutating it bypasses the cleanup that
`delete()` does — which is the one way to leave a key behind with an empty set under it:

```ts
const clicks = new SetMap<string, () => void>();
clicks.add('click', onClick);

clicks.get('click')!.delete(onClick); // Bypasses the cleanup.
clicks.keys; // ['click'] — still there, now holding nothing.
```

## API

| Member               | Description                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `add(key, value)`    | Adds `value` under `key`, creating the set on first use. Returns the map, so calls chain.              |
| `delete(key, value)` | Removes `value` from `key`, dropping the key when that was its last value. Returns whether it removed. |
| `deleteKey(key)`     | Drops the key and every value under it at once. Returns whether the key was there.                     |
| `clear()`            | Empties the map.                                                                                       |
| `get(key)`           | The live `Set` backing `key`, or `undefined`.                                                          |
| `valuesForKey(key)`  | The values under `key` as a new array, empty when the key is absent.                                   |
| `has(key, value)`    | Whether `value` is stored under `key`.                                                                 |
| `keys`               | Every key the map is holding. One emptied through `get()` stays until deleted.                         |
| `values`             | Every value across every key, flattened in insertion order.                                            |
