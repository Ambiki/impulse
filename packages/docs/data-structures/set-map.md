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

handlers.getValuesForKey('click'); // [onClick, onClickAgain]
handlers.has('click', onClick); // true
handlers.keys; // ['click', 'focus']
```

A key exists only while it holds at least one value. Deleting the last value under a key drops the key too, so `keys`
never reports an empty bucket and a long-lived map does not accumulate an entry for every key it has ever seen.

```ts
handlers.delete('focus', onFocus);
handlers.keys; // ['click']
handlers.get('focus'); // undefined
```

## Reading values

`getValuesForKey()` returns an array, empty when the key is absent. It is a snapshot, so it is safe to iterate while
deleting from the map.

```ts
for (const handler of handlers.getValuesForKey('click')) {
  handlers.delete('click', handler); // Safe: the array is not the live set.
}
```

`get()` returns the live `Set` instead, or `undefined` when the key is absent. Mutating it bypasses the cleanup that
`delete()` does, leaving an empty set behind under the key, so prefer the methods above unless you need the set
itself.

```ts
handlers.get('click'); // Set { onClick, onClickAgain }
```

`values` flattens every key's values into one array, in insertion order. Values are not deduplicated across keys, so
something stored under two keys appears twice.

```ts
handlers.values; // [onClick, onClickAgain, onFocus]
```

## API

| Member                     | Description                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| `add(key, value)`          | Adds `value` under `key`, creating the set on first use.                        |
| `delete(key, value)`       | Removes `value` from `key`, dropping the key when that was its last value.      |
| `deleteKey(key)`           | Drops the key and every value under it at once.                                 |
| `clear()`                  | Empties the map.                                                                |
| `get(key)`                 | The live `Set` backing `key`, or `undefined`.                                   |
| `getValuesForKey(key)`     | The values under `key` as a new array, empty when the key is absent.            |
| `has(key, value)`          | Whether `value` is stored under `key`.                                          |
| `keys`                     | Every key currently holding at least one value.                                 |
| `values`                   | Every value across every key, flattened in insertion order.                     |
