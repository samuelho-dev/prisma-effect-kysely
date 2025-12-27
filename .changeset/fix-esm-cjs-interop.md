---
"prisma-effect-kysely": patch
---

Fix ESM/CJS interop for Prisma 7.x compatibility

Node.js ESM cannot use named imports from CJS modules. Changed `@prisma/generator-helper` import to use default import pattern:

```typescript
// Before (broken in ESM)
import { generatorHandler } from '@prisma/generator-helper';

// After (works)
import pkg from '@prisma/generator-helper';
const { generatorHandler } = pkg;
```

Added ESM compatibility tests to prevent future regressions.
