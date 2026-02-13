---
"prisma-effect-kysely": patch
---

fix: wrap Json fields with columnType to prevent Kysely TS2589

Kysely's built-in `InsertType<T>` and `UpdateType<T>` are distributive conditional
types that recursively expand `JsonValue` unions, causing TS2589 on `.values()` and
`.set()` calls for tables with Json fields.

By wrapping Json fields with `columnType(JsonValue, JsonValue, JsonValue)` in the
generated output, Kysely's `InsertType` takes the ColumnType fast path (extracts via
`infer`) instead of distributing over the recursive union.
