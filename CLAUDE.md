---
scope: project
updated: 2026-09-22
relates_to:
  - src/prisma/type.ts
  - src/effect/generator.ts
  - src/kysely/type.ts
  - src/generator/orchestrator.ts
---

# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Overview

Effect 4-only Prisma generator. Generated files own their Effect database codecs and native Kysely table contracts; the package publishes no application runtime helpers.

## Commands

Bun is the only package manager.

```bash
bun install
bun run build               # tsc -p tsconfig.lib.json
bun run test                # vitest run
bun run test src/__tests__/<file>.test.ts
bun run typecheck           # library + spec TypeScript projects
bun run lint
bun run prepublishOnly      # lint + both typechecks + test + build
```

Build and typecheck scripts invoke TypeScript 7 through `@typescript/native`. The unscoped TypeScript 6 package is an API-only compatibility dependency for typescript-eslint; TypeScript 7.0 has no programmatic compiler API.

## Architecture

Entry: `src/cli.ts` accepts Prisma 8 `contract` generation and delegates to `GeneratorOrchestrator`.

Generators:

- `src/contract/adapter.ts` — Prisma 8 PostgreSQL contract → explicit DMMF subset
- `src/effect/generator.ts` — branded IDs and select/insert/update codecs
- `src/effect/enum.ts` — named stored-value enums and `Schema.Enum` codecs
- `src/kysely/type.ts` — named native `ColumnType` table interfaces and `DB`
- `src/kysely/generator.ts` — output assembly facade

Support: `src/utils/templates.ts` formats generated TypeScript, and
`src/prisma/` owns DMMF parsing, field ownership, relation detection, and
deterministic sorting. The contract adapter rejects unsupported targets/codecs
instead of widening them.

## Package boundary

- Required peers: exact `effect@4.0.0-rc.117` and `kysely@^0.29.6`.
- Published API: `prisma-effect-kysely` contract generator executable only.
- Prisma 8 emits the PostgreSQL contract; `@prisma/generator-helper` remains development-only for the normalized internal model types and tests.
- Generated files import `effect`, `effect/unstable/schema`, and `kysely` directly. They never import `prisma-effect-kysely`.

## Generated output

Three files per output directory:

- `enums.ts` — named TypeScript enum members and their `Schema.Enum` codecs
- `types.ts` — branded IDs, operation codecs, named table interfaces, and `DB`
- `index.ts` — re-exports

In multi-domain mode, every namespace writes all three files beneath
`<output>/<namespace>/src/generated`, including `enums.ts`. Each domain's
`types.ts` declares every ID brand referenced by its emitted fields.

Generation order is fixed: imports/toolkit, branded IDs, model codecs, table interfaces, then `DB`.

For each model, a private `<Model>Fields = DatabaseSchema.Struct(...)` is extracted into:

- `<Model>` — select codec
- `<Model>Insert` — insert codec
- `<Model>Update` — update codec

Each export has a `typeof <Codec>.Type` alias. Do not export field containers,
attach variants as properties, or introduce `Model.Class`.

`Schema.encodeKeys` is applied after extraction. Codec `Type` values use Prisma
semantic field names with driver-native leaves; codec `Encoded` values use
physical `@map` column names with those same leaves. Update mappings exclude
omitted primary-key fields.

## Native Kysely contract

Each model emits `<Model>Table` with physical column keys and branded,
driver-native leaves from the semantic operation types:

```typescript
ColumnType<
  (typeof Model.Type)['semanticField'],
  (typeof ModelInsert.Type)['semanticField'],
  Exclude<(typeof ModelUpdate.Type)['semanticField'], undefined>
>;
```

Primary-key updates are `never` and never index the update codec. `DB` uses physical `@@map` table names and points to named table interfaces.

Single-output generation schema-qualifies only duplicate physical table keys as
`<namespace>.<table>`; unique and multi-domain table keys remain bare.

Kysely interfaces retain physical table and column keys, driver-native leaves,
and generated ID/custom brands. PostgreSQL `BigInt` is `string` in Kysely and
in generated codec `Type`/`Encoded` values. Generated codecs validate values
and map keys but do not coerce scalar values before or after a query.

## Field ownership

`getFieldOperationConfig(model, field)` in `src/prisma/type.ts` is authoritative for both Effect and Kysely emitters.

- Insert optional: nullable field or database-owned default.
- Database-owned defaults: scalar/array literals, `autoincrement`, `dbgenerated`, or `now`.
- Required insert: Prisma Client defaults (`uuid`, `cuid`, `ulid`, `nanoid`), unknown functions, missing default payloads, and bare `@updatedAt`.
- Update allowed: non-primary-key fields only. Every composite `@@id` component is excluded.
- `@updatedAt` plus a recognized database default follows that default for insert and remains updateable.

Never duplicate these conditions inside an emitter.

## Type mappings

| Prisma / PostgreSQL codec | Generated codec and Kysely leaf                   |
| ------------------------- | ------------------------------------------------- |
| String                    | `Schema.String` / `string`                        |
| UUID string               | `Schema.String.check(Schema.isUUID())` / `string` |
| Int                       | `Schema.Int` / `number`                           |
| Float                     | `Schema.Number` / `number`                        |
| BigInt                    | `Schema.String` / `string`                        |
| Decimal                   | `Schema.String` / `string`                        |
| Boolean                   | `Schema.Boolean` / `boolean`                      |
| PostgreSQL date           | `Schema.String` / `string`                        |
| PostgreSQL time           | `Schema.String` / `string`                        |
| PostgreSQL timestamp      | native `Date`                                     |
| PostgreSQL timestamptz    | native `Date`                                     |
| PostgreSQL interval       | `{ months, days, micros }`                        |
| Json                      | `Schema.Json` / JSON value                        |
| Bytes                     | `Schema.Uint8Array` / `Uint8Array`                |
| Enum                      | `Schema.Enum(...)` / named stored enum member     |

Incoming Prisma `*-temporal` contract identifiers map directly to PostgreSQL
driver-native values: date/time are strings, timestamp/timestamptz are `Date`,
and interval is `{ months, days, micros }`. Generated codecs do not coerce
values.

Arrays use readonly `Schema.Array`. Nullable values use `Schema.NullOr`.
`@customType(...)` defines only the scalar refinement; the generator applies
`isList` and `isRequired` cardinality around it.

## Join models

Prisma 8 contract models remain ordinary models, including explicit join models
whose physical table names begin with `_`. A table name never removes a model or
creates synthetic relations.

## UUID detection

`isUuidField()` in `src/prisma/type.ts` trusts DMMF only:

1. `field.nativeType[0] === "Uuid"`
2. `field.documentation` includes `@db.Uuid`

Never infer UUIDs from names. External identifiers ending in `_id` are often text.

## Working in this repo

- Run `bun run test` before changes; record pre-existing failures.
- Rebuild before invoking the package CLI against a Prisma 8 contract artifact.
- Main fixture: `src/__tests__/fixtures/test.prisma`.
- Generated headers contain a timestamp and `DO NOT EDIT MANUALLY` marker.
- Generated installation replaces only owned files and preserves unrelated output files.
- Consumer-contract tests must compile generated output and exercise codecs/query builders; do not pin helper spelling or Effect internals.
