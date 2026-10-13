# AGENTS.md

Guidance for coding agents working in this repository. (See `CLAUDE.md` for the
full project reference — commands, architecture, the Effect 3→4 migration notes,
and the v4 API map. This file documents the vendored reference source.)

## Vendored reference source

This project vendors external source under `repos/` as **read-only reference
material** (via `git subtree`, not a submodule — no init needed).

- Use vendored source to learn idiomatic usage; never import from it or edit it.
- Published declarations/source for the pinned stable `effect@4.0.3` are the
  source of truth (`node_modules/effect/dist` and `node_modules/effect/src`).
  Vendored prerelease source and Effect 3 documentation may have stale APIs.
- `repos/` is excluded from TypeScript compilation, ESLint, Prettier, and the
  npm package (`files` allowlist). Do not add it to any `include`/`files` list.

For Schema work, start with the distilled cheat-sheet **`agent-patterns/effect-schema.md`**
(v4 constructors, filters, branding/`encodeKeys`, the v3→v4 traps, and this
package's operation codecs and native Kysely contracts), then consult the
installed stable package for exact signatures.

### `repos/effect/` — historical Effect v4 prerelease source

The vendored `Effect-TS/effect-smol` snapshot is historical reference only.
For current API shapes and signatures, inspect the installed stable Effect
package instead; never let this snapshot override published declarations.

High-value files for this generator:

- `node_modules/effect/src/Schema.ts` — `Top`, `Bottom`, `Codec`,
  `Struct`, `brand`, `check`, `encodeKeys`, `Literals`, `Enum`, and `is*` filters.
  `Top` is the structural base every schema must satisfy.
- `node_modules/effect/src/SchemaAST.ts` — AST node types (`Objects`,
  `PropertySignature`, `resolve`, the `is*` guards). v4 reworked this heavily
  from v3.

### Effect 3 → 4 quick map

- `Schema.Schema<T,E,R>` → `Schema.Codec<T,E,RD,RE>`; `Schema.Schema.All` →
  `Schema.Top`; `Schema.Schema.Type<S>` → `Schema.Schema.Type<S>` (kept);
  `Schema.Codec.Encoded/DecodingServices/EncodingServices<S>` for the rest.
- `asSchema` → `revealCodec`; `.annotations({})` → `.annotate({})`.
- `Schema.DateFromSelf` → `Schema.Date`; `Schema.UUID` →
  `Schema.String.check(Schema.isUUID())`; `Schema.BigIntFromSelf` → `Schema.BigInt`.
- Filters moved under `.check(Schema.is*)` (e.g. `Schema.int()` →
  `Schema.check(Schema.isInt())`, `Schema.between(a,b)` →
  `Schema.check(Schema.isBetween({ minimum, maximum }))`).
- Variadic combinators take arrays: `Schema.Union(a,b)` → `Schema.Union([a,b])`,
  `Schema.Literal(a,b)` → `Schema.Literals([a,b])`, `Schema.Tuple(...)` → array.
- `Schema.Enums` → `Schema.Enum` for existing TS enum interop. For generated
  Prisma enum value sets, prefer `Schema.Literals([...])` so Type and Encoded
  are the same string literal union.
- `Schema.propertySignature(...).pipe(Schema.fromKey(...))` → struct-level
  `Schema.encodeKeys({ tsName: "db_col" })`.

## Updating the vendored source

```bash
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect-smol.git main --squash
```

The snapshot may lag the stable `effect` development pin; do not use it as an API contract.
