---
'prisma-effect-kysely': major
---

Replace the Prisma 7 generator protocol with the Prisma 8 contract CLI. Generate artifacts with `prisma contract emit`, then run `prisma-effect-kysely contract --contract <contract.json> --schema <contract.prisma> --output <directory>`; Prisma 7 generator blocks remain supported by the 6.x release line.

Prisma-applied ID generators such as `@default(uuid())` and `@default(cuid(2))` are now insertable in Kysely because Prisma 8 contracts correctly distinguish them from database defaults.
