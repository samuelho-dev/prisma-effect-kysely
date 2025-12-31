---
'prisma-effect-kysely': patch
---

Always emit strict Select/Insert/Update aliases (using the `Strict` suffix) and remove the temporary generator flags so there is a single, consistent schema typing workflow.
