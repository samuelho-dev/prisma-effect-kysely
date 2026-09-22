---
'prisma-effect-kysely': major
---

Cut over to generator-only Effect `4.0.0-rc.117` output with required Kysely peers. Remove the package root and runtime helper exports, and replace generated helper-wrapped schemas with select/insert/update codecs plus named native Kysely table interfaces. Prisma `Int` fields now use `Schema.Int`, rejecting fractional, non-finite, and unsafe numeric values. Add first-class Prisma 8 PostgreSQL `contract.json` generation through the `prisma-effect-kysely contract` command while retaining the Prisma 7 generator protocol.
