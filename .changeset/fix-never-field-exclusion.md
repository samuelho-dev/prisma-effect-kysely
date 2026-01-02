---
"prisma-effect-kysely": patch
---

Fix: Exclude Never-typed fields from Updateable and Insertable schemas

Previously, fields with `columnType(T, Schema.Never, Schema.Never)` were incorrectly included in Updateable/Insertable schemas because `Schema.mutable()` wrapped the Never type in a Transformation node, changing the AST tag from `'NeverKeyword'` to `'Transformation'`. The filter at line 155 checked for `'NeverKeyword'` but couldn't detect the wrapped Never type.

**Fix**: Check for `AST.isNeverKeyword(targetSchema.ast)` before applying the `Schema.mutable()` transformation, then filter out null values.

This ensures read-only ID fields like `id: columnType(Schema.UUID, Schema.Never, Schema.Never)` are properly excluded from update and insert operations, maintaining Kysely's type safety guarantees.
