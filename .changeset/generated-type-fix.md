---
"prisma-effect-kysely": patch
---

Fix: properly brand `generated()` return type for type-level Insertable filtering

The `generated()` function was returning `Schema<SType, ...>` instead of `Schema<Generated<SType>, ...>`, which meant the Generated brand was not present at the type level.

Also fixed `Generated<T>` type to use `__insert__: never` (instead of `T | undefined`) to match the runtime behavior where `Insertable()` completely filters out generated fields rather than making them optional.

This fixes type errors in consuming projects where `Insertable<T>` was including all fields instead of excluding generated ones.
