---
'prisma-effect-kysely': patch
---

Move `@prisma/generator-helper` from `dependencies` to `devDependencies`.

### Why

The `@prisma/generator-helper` package uses Node.js internals (`node:child_process`, `node:readline`) that are only needed by the generator code, not by runtime helpers.

### Impact

- **Generator code**: Still works - has access to `devDependencies` during `prisma generate`
- **Runtime helpers** (`columnType`, `generated`, `Selectable`, `Insertable`, `Updateable`): No changes - they're pure TypeScript/Effect-TS and don't depend on `@prisma/generator-helper`
- **Consumers**: Cleaner install when importing from `./kysely` or `./runtime` entry points - won't install unnecessary Node.js dependencies

### Technical Details

Most files only use type-only imports (`import type { DMMF } from '@prisma/generator-helper'`), which don't load the package at runtime. Only `src/generator/index.ts` uses the actual `generatorHandler` function, which is only invoked during `prisma generate`.
