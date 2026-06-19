# Getting started

## Installation

```bash
yarn add @ambiki/impulse
```

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
