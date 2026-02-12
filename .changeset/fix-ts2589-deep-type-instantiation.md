---
"prisma-effect-kysely": patch
---

Fix TS2589 "Type instantiation is excessively deep" when using Insertable/Updateable with Kysely's .values() and .set()

Replace recursive `DeepMutable<T>` from `effect/Types` with shallow `-readonly` mapped types
in `CustomInsertable<T>` and `CustomUpdateable<T>`. `DeepMutable` recursively visits every
nested property, which combined with Kysely's per-column `ValueExpression` type checking
exceeds TypeScript's ~50-level depth limit on schemas with 20+ fields.

Runtime array mutability is unaffected — `Schema.mutable()` already handles this in the
`Insertable()` and `Updateable()` functions.
