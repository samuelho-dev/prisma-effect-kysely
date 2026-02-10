---
"prisma-effect-kysely": patch
---

Fix Int/BigInt primary keys generating `Schema.String` instead of correct type

Models with `Int @id` (e.g. autoincrement integer PKs) incorrectly generated
`Schema.String.pipe(Schema.brand("TodoId"))`. Now correctly generates
`Schema.Int.pipe(Schema.brand("TodoId"))` for Int PKs and
`Schema.BigIntFromSelf.pipe(Schema.brand("CounterId"))` for BigInt PKs.

UUID and String ID fields are unchanged.

Closes #16. Related: #17.
