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
`@property()` and `@target()` fails to compile with `TS1240: Unable to resolve signature of property decorator when
called as an expression`.
:::
