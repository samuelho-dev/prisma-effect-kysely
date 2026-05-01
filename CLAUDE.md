---
scope: project
updated: 2026-04-30
relates_to:
  - src/kysely/helpers.ts
  - src/effect/generator.ts
  - src/generator/orchestrator.ts
---

# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Overview

Prisma generator emitting Effect Schema types with Kysely-compatible column metadata, branded IDs, and UUID detection.

## Commands

Bun is the only package manager.

```bash
bun install
bun run build               # tsc -p tsconfig.lib.json
bun run test                # vitest run
bun run test src/__tests__/<file>.test.ts
bun run typecheck           # tsc --noEmit
bun run lint
bun run prepublishOnly      # lint + typecheck + test + build
```

## Architecture

Entry: `src/generator/index.ts` exposes the Prisma generator manifest and delegates to `GeneratorOrchestrator` (`src/generator/orchestrator.ts`), which validates output, runs generators in parallel, and logs progress.

Generators:

- `src/effect/generator.ts` — model schemas + branded IDs
- `src/effect/enum.ts` — Prisma enums → `Schema.Literals`
- `src/effect/join-table.ts` — implicit M2M join tables
- `src/kysely/type.ts` — `DB` interface
- `src/effect/emit-tokens.ts` — emitted-string tokens (single swap point for the Schema source shape)

Support: `src/utils/file-manager.ts` (FS), `src/utils/templates.ts` (Prettier formatting), `src/prisma/` (DMMF parsing, type utils, relation detection).

## Output

Three files in the configured output directory:

- **enums.ts** — `Schema.Literals([...])` per Prisma enum (respects `@map`)
- **types.ts** — direct exports (no underscore prefix, no wrapper functions):
  - Branded ID schema + type per model
  - Model `Schema.Struct` + type alias, plus `.pipe(Schema.encodeKeys({...}))` if any field uses `@map`
  - `DB` interface using `Schema.Schema.Type<typeof Model>` per table (respects `@@map`)
- **index.ts** — re-exports

## Generated shape

```typescript
export const UserId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const User = Schema.Struct({
  id: columnType(UserId, Schema.Never, Schema.Never),
  email: Schema.String,
  createdAt: generated(Schema.Date),
});
export type User = typeof User;

export interface DB {
  User: Schema.Schema.Type<typeof User>;
}
```

Consumers use `Selectable<typeof User>` / `Insertable<typeof User>` / `Updateable<typeof User>` from `prisma-effect-kysely`. Branded IDs imported directly.

## Field behavior

- `@default` or `@updatedAt` → `generated()` (omitted from insert, optional in update)
- `@id` with `@default` → `columnType(type, Schema.Never, Schema.Never)` (read-only)
- Optional → `Schema.NullOr(type)`
- Foreign keys → branded ID of target model
- Relations excluded — only scalars + enums in schemas
- Models starting with `_` filtered out
- Output sorted alphabetically (deterministic)

## Implicit M2M join tables

Prisma stores `A`/`B` columns; we emit semantic snake_case fields and a struct-level `.pipe(Schema.encodeKeys({ x_id: "A", y_id: "B" }))`. Join tables get NO branded ID (composite key).

## UUID detection

`isUuidField()` in `src/prisma/type.ts`, priority order:

1. `field.nativeType[0] === 'Uuid'` (from `@db.Uuid`)
2. `field.documentation` includes `@db.Uuid`
3. Name regex: `id`, `*_id`, `*_uuid`, `uuid`

## Type mappings

| Prisma      | Effect                                 | Notes                                          |
| ----------- | -------------------------------------- | ---------------------------------------------- |
| String      | `Schema.String`                        | UUID → `Schema.String.check(Schema.isUUID())` |
| Int / Float | `Schema.Number`                        | `@id` Int → `.check(Schema.isInt())`           |
| BigInt      | `Schema.BigInt`                        | bigint↔bigint                                  |
| Decimal     | `Schema.String`                        | precision                                      |
| Boolean     | `Schema.Boolean`                       |                                                |
| DateTime    | `Schema.Date`                          | Type = Encoded = Date                          |
| Json        | `JsonValue`                            | recursive runtime schema                       |
| Bytes       | `Schema.Uint8Array`                    |                                                |
| Enum        | `Schema.Literals([...])`               | over @map'd DB values                          |

Arrays → `Schema.Array(t)`. Nullable → `Schema.NullOr(t)`.

## Type safety principles

- Zero coercion — exact DMMF types, no `as` casts
- UUID detection from DMMF, not string parsing
- Field defaults validated via DMMF structure
- Strict mode (tsconfig)

## Package exports

All five entries currently resolve to the same `dist/kysely/helpers.js`; the named subpaths exist for namespacing future splits without breaking consumers.

| Entry          | Contents                                          |
| -------------- | ------------------------------------------------- |
| `.`            | `Selectable`, `Insertable`, `Updateable`, helpers |
| `./generator`  | Prisma generator binary entry                     |
| `./kysely`     | `columnType`, `generated`, type utilities         |
| `./error`      | (currently same as `.`; reserved)                 |
| `./runtime`    | (currently same as `.`; reserved)                 |

## Working in this repo

- Run `bun run test` to baseline before changes (currently 356 tests)
- Generator must be rebuilt (`bun run build`) before `prisma generate` picks up changes
- Test fixtures: `src/__tests__/fixtures/test.prisma`
- Generator output snapshot at `src/__tests__/__snapshots__/generator-output-snapshot.test.ts.snap` pins the emit shape; review diffs before updating
- Generated headers include timestamp + edit warning
- Direct exports only — never reintroduce underscore prefixes or wrapper functions in generated code
