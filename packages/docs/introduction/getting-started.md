# Getting started

## Installation

```bash
yarn add @ambiki/impulse
```

You need to disable the typescript's `strictPropertyInitialization` compiler option so that it does not conflict
with Impulse's `@target()`, `@targets()`, and `@property()` decorators.

```json
{
  "compilerOptions": {
    "strict": true,
    "strictPropertyInitialization": false,
    "useDefineForClassFields": false
  }
}
```
