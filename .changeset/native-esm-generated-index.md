---
'prisma-effect-kysely': patch
---

Emit `.js` relative imports and re-exports in generated files so the public index compiles with TypeScript NodeNext and loads as native Node ESM. Add a generated-index consumer regression using stable Effect 4.0.3 and Kysely DB/model types.
