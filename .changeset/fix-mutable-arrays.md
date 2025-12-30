---
'prisma-effect-kysely': patch
---

Fix mutable array types for Kysely insert/update operations. Schema.Array(...) now produces mutable T[] instead of readonly T[] for Insertable and Updateable schemas.
