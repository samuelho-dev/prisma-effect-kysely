---
"prisma-effect-kysely": minor
---

Add JsonValue schema type for Prisma Json fields

- Add recursive `JsonValue` type and Effect Schema export to replace `Schema.Unknown` for Prisma `Json` fields
- Fix `isNullType` to check literal value directly instead of missing annotation, making nullable fields correctly optional on insert
- Update generator to emit `JsonValue` instead of `Schema.Unknown` and include it in the import line

This prevents `Schema.NullOr(Schema.Unknown)` from collapsing to `unknown`, which caused the TS language server to hit depth limits resolving `Selectable<T>` types.
