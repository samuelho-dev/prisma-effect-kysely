---
"prisma-effect-kysely": patch
---

fix: Insertable<T> type utility now correctly excludes generated() fields at compile-time

The previous implementation used phantom types with unique symbols which don't maintain identity across module boundaries when compiled to .d.ts files. This caused the type utility to include generated() fields even though the runtime schema correctly excluded them.

The fix simplifies the type utilities to trust the pre-computed runtime schemas. Since getSchemas() already computes the correct Insertable/Updateable schemas with generated() fields excluded, the type utility now simply extracts types from these schemas rather than re-computing field exclusions using phantom types.

This aligns with the @effect/sql pattern where schema variants are pre-computed and trusted.
