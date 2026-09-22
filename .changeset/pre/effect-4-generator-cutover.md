---
'prisma-effect-kysely': major
---

Cut over to generator-only Effect `4.0.0-rc.117` output with required Kysely `^0.29.6` peers. Remove the package root, runtime helpers, and legacy Prisma 7 generator protocol; Prisma 8 contract artifacts are the only generation path. Generated output owns select/insert/update codecs plus named native Kysely table interfaces with physical database keys and decoded semantic leaf values, so normal queries do not require codec wrapping. Prisma `Int` fields use `Schema.Int`, rejecting fractional, non-finite, and unsafe numeric values. Custom type annotations define only scalar refinements while the generator applies Prisma list and nullability cardinality.
