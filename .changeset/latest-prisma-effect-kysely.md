---
"prisma-effect-kysely": patch
---

Upgrade the generator toolchain to Prisma 8 RC.15, Effect 4 RC.117, Kysely 0.29, TypeScript 7, Vitest 5, and the current supporting dependencies. Remove the legacy Prisma 7 generator entry so generation uses Prisma 8 contract artifacts exclusively. Kysely table leaves now use decoded semantic values without per-query codec wrapping, foreign-key primary keys retain the referenced model brand, contract enum names remain stable, and `@customType` supplies only the scalar refinement while the generator applies Prisma list and nullability cardinality.
