# Getting started

## Installation

::: code-group

```sh [npm]
$ npm install @ambiki/impulse
```

```sh [pnpm]
$ pnpm add @ambiki/impulse
```

```sh [yarn]
$ yarn add @ambiki/impulse
```

```sh [bun]
$ bun add @ambiki/impulse
```

:::

Impulse's `@registerElement()`, `@target()`, `@targets()`, and `@property()` decorators use TypeScript's legacy
decorator convention, so turn on `experimentalDecorators`. Disable `strictPropertyInitialization` as well, so that
declaring a target or a property without an initializer is not an error.

```json
{
  "compilerOptions": {
    "strict": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "useDefineForClassFields": false
  }
}
```

::: warning
`experimentalDecorators` is required. TypeScript 5 and later default to the standard (stage 3) decorators, which
Impulse does not support yet — see [issue #183](https://github.com/Ambiki/impulse/issues/183). Without the flag, every
`@property()`, `@target()`, and `@targets()` fails to compile with `TS1240: Unable to resolve signature of property
decorator when called as an expression`, and they throw at runtime because a standard decorator is handed a different
set of arguments.
:::

## Loading your elements

`@registerElement()` defines the element when its file runs, so import every element file from your application's entry
point (or load it with [`lazyImport`](/utilities/lazy-import)):

```ts
// application.ts
import './elements/clip_board_element';
import './elements/lazy_load_element';
```

## The descendant-wait warning

An element whose markup contains a custom element that is not defined yet logs a deprecation warning when it
initializes. See [`[target]Connected()`](/reference/lifecycle-callbacks#target-connected) for what to change and how to
silence it.
