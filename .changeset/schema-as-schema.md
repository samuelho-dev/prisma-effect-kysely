---
'prisma-effect-kysely': patch
---

Ensure every generated Kysely schema returns the `Schema` interface by wrapping `Schema.make(...)` results with `Schema.asSchema()` and updating the mutable insert/update helpers to keep their runtime types aligned.
