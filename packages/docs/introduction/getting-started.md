# Getting started

## Installation

::: code-group

```sh [npm]
npm install @ambiki/impulse
```

```sh [pnpm]
pnpm add @ambiki/impulse
```

```sh [yarn]
yarn add @ambiki/impulse
```

```sh [bun]
bun add @ambiki/impulse
```

:::

Disable TypeScript's `strictPropertyInitialization` compiler option so it does not conflict with Impulse's
`@target()`, `@targets()`, and `@property()` decorators.

```json
{
  "compilerOptions": {
    "strict": true,
    "strictPropertyInitialization": false,
    "useDefineForClassFields": false
  }
}
```
