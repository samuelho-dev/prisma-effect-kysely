---
'prisma-effect-kysely': minor
---

Select/Insert/Update aliases now use `StrictType` directly, so they match Effect schemas without index signatures and the old `*Strict` exports are gone.
