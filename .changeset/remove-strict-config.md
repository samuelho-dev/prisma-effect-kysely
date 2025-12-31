---
'prisma-effect-kysely': minor
---

Default `Select` / `Insert` / `Update` aliases now use strict typing (no `[key: string]: unknown`), so there is a single canonical type per schema and the extra `*Strict` exports/config switches have been removed.
