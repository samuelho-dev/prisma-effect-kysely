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
- `src/effect/enum.ts` — native TypeScript enums wrapped by `Schema.Enum`
- `src/effect/join-table.ts` — implicit M:N select/insert codecs
- `src/kysely/type.ts` — named native `ColumnType` table interfaces and `DB`
- `src/kysely/generator.ts` — output assembly facade

Support: `src/utils/file-manager.ts` handles transactional generated-file
installation, `src/utils/templates.ts` formats generated TypeScript, and
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

- `enums.ts` — mapped native enum values plus `Schema.Enum` codecs
- `types.ts` — branded IDs, operation codecs, join codecs, named table interfaces, and `DB`
- `index.ts` — re-exports

Generation order is fixed: imports/toolkit, branded IDs, model codecs, join codecs, table interfaces, then `DB`.

For each model, a private `<Model>Fields = DatabaseSchema.Struct(...)` is extracted into:

- `<Model>` — select codec
- `<Model>Insert` — insert codec
- `<Model>Update` — update codec

Each export has a decoded alias using `typeof <Codec>.Type`. Do not export field containers, attach variants as properties, or introduce `Model.Class`.

`Schema.encodeKeys` is applied after extraction. Decoded codec values use Prisma semantic field names; encoded values use physical `@map` column names. Update mappings exclude omitted primary-key fields.

## Native Kysely contract

Each model emits `<Model>Table` with physical column keys and native:

```typescript
ColumnType<
  typeof Model.Type['semanticField'],
  typeof ModelInsert.Type['semanticField'],
  Exclude<typeof ModelUpdate.Type['semanticField'], undefined>
>;
```

Primary-key updates are `never` and never index the update codec. `DB` uses physical `@@map` table names and points to named table interfaces.

Kysely interfaces retain physical table and column keys while their leaf values use decoded semantic types. Database drivers serialize native inputs such as `bigint`; generated codecs remain available for validation and semantic/physical key conversion, not routine query wrapping.

## Field ownership

`getFieldOperationConfig(model, field)` in `src/prisma/type.ts` is authoritative for both Effect and Kysely emitters.

- Insert optional: nullable field or database-owned default.
- Database-owned defaults: scalar/array literals, `autoincrement`, `dbgenerated`, or `now`.
- Required insert: Prisma Client defaults (`uuid`, `cuid`, `ulid`, `nanoid`), unknown functions, missing default payloads, and bare `@updatedAt`.
- Update allowed: non-primary-key fields only. Every composite `@@id` component is excluded.
- `@updatedAt` plus a recognized database default follows that default for insert and remains updateable.

Never duplicate these conditions inside an emitter.

## Type mappings

| Prisma      | Effect 4                               |
| ----------- | -------------------------------------- |
| String      | `Schema.String`                        |
| UUID string | `Schema.String.check(Schema.isUUID())` |
| Int         | `Schema.Int`                           |
| Float       | `Schema.Number`                        |
| BigInt      | `Schema.BigIntFromString`              |
| Decimal     | `Schema.String`                        |
| Boolean     | `Schema.Boolean`                       |
| DateTime    | `Schema.Date`                          |
| Json        | `Schema.Json`                          |
| Bytes       | `Schema.Uint8Array`                    |
| Enum        | imported `Schema.Enum` codec           |

Arrays use readonly `Schema.Array`. Nullable values use `Schema.NullOr`. `@customType(...)` defines only the scalar refinement; the generator applies `isList` and `isRequired` cardinality around it.

## Implicit M:N join tables

Join tables emit only `<Relation>` and `<Relation>Insert` codecs. Semantic `<model>_id` fields map through `Schema.encodeKeys` to physical `A`/`B`. Both inserts are required and branded. `<Relation>Table` exposes only `A` and `B`, both with update type `never`.

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
