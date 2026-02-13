---
"prisma-effect-kysely": patch
---

fix: use non-distributive conditional types to prevent TS2589 on JsonValue fields

Replace distributive conditional types with non-distributive `[T] extends [...]` pattern
in ExtractInsertType, ExtractUpdateType, StripGeneratedWrapper, and StripColumnTypeWrapper.
This prevents TypeScript from distributing over recursive JsonValue unions (which triggers
TS2589) while correctly unwrapping Generated<T> and ColumnType<S,I,U> types.
