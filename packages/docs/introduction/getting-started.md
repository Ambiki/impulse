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

Impulse's `@registerElement()`, `@property()`, `@target()`, and `@targets()` decorators work with either of
TypeScript's decorator conventions: the standard decorators TypeScript 5 and later compile by default, or the legacy
ones that `experimentalDecorators` turns on. With either, disable `strictPropertyInitialization`, so that declaring a
target or a property without an initializer is not an error.

::: code-group

```json [Standard decorators]
{
  "compilerOptions": {
    "strict": true,
    "strictPropertyInitialization": false
  }
}
```

```json [Legacy decorators]
{
  "compilerOptions": {
    "strict": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false
  }
}
```

:::

`useDefineForClassFields` can take either value. Impulse's types need TypeScript 5.0 or later, and standard decorators
need 5.2 or later, the first version to pass them decorator metadata. They keep what they declare on `Symbol.metadata`,
which Impulse defines when the browser doesn't.

Other compilers follow the same choice. esbuild, and Vite 7 and earlier with it, reads `experimentalDecorators` from
your `tsconfig.json`, and supports standard decorators from 0.21. Vite 8 compiles TypeScript with Oxc, which handles
legacy decorators but can't compile standard ones yet, so with Vite 8 use legacy decorators, or compile standard ones
with Babel as [Vite's migration guide](https://vite.dev/guide/migration) shows. With Babel, use
`@babel/plugin-proposal-decorators` with `version: '2023-11'` for standard decorators, or `version: 'legacy'` for legacy
ones, which also need `@babel/plugin-transform-class-properties` after it.

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

Upgrading from 1.x? See [Upgrading to 2.0](/introduction/upgrading-to-2).
