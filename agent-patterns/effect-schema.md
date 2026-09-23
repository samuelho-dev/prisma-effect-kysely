# Effect Schema patterns (v4)

Distilled reference for writing Effect `Schema` code in this project. The source
of truth is the vendored `repos/effect/packages/effect/src/Schema.ts` and
`SchemaAST.ts` — consult them for exact signatures. This file captures the
patterns this generator relies on and the v3→v4 traps that bit us.

**This project targets Effect 4 (beta). The published Effect docs are v3 and are
wrong here — always verify against `repos/effect`, not the website.**

## Core types

- `Schema.Top` — the structural base every schema satisfies (= `Bottom<...>` with
  ~23 members: `[TypeId]`, `ast`, `Rebuild`, `Iso`, `~type.parameters`, `Type`,
  `Encoded`, etc.). A `Schema.Struct` field must be a `Top`.
- `Schema.Codec<T, E, RD, RE>` → extends `Schema<T>` → extends `Top`. The common
  schema type. `Codec.Encoded<S>`, `Codec.DecodingServices<S>`, `Codec.EncodingServices<S>`.
- `Schema.Schema.Type<S>` — extract the decoded type (this name is unchanged in v4).
- A **named interface that `extends Schema.Codec<...>`** does NOT reliably re-expose
  `Top`'s members under strict checkers — declare it `extends Schema.Bottom<...all
15 params...>` like Effect's own `brand<S,B>` if you need a named schema interface,
  and hardcode the `TypeParameters` slot to `readonly []` (forwarding `S['~type.parameters']`
  breaks when `S` is itself branded). See `repos/effect/.../Schema.ts` `brand`/`refine`.

## Constructors & combinators

```ts
Schema.Struct({ a: Schema.String, b: Schema.optional(Schema.Number) });
Schema.Array(Schema.String); // readonly; Schema.mutable(...) for mutable (arrays only!)
Schema.NullOr(Schema.String); // T | null
Schema.Union([A, B]); // ARRAY in v4 (was variadic Union(A, B))
Schema.Literal('x'); // single literal — unchanged
Schema.Literals(['a', 'b']); // multiple — was Schema.Literal('a','b')
Schema.Record(Schema.String, Schema.Number);
Schema.Enum(NativeTsEnum); // was Schema.Enums; only for existing TS enum/const object interop
Schema.suspend(() => JsonValue); // recursive schemas
```

Generated Prisma enums should use `Schema.Literals([...])`, not `Schema.Enum`.
That keeps `Type` and `Encoded` as the same stored string or integer literal
union, which is the shape Kysely expects for enum columns.

## Filters: `.check(Schema.is*)`

All filters moved under `.check(...)` in v4 (no more `.pipe(Schema.positive())`):

```ts
Schema.String.check(Schema.isMinLength(3));
Schema.Number.check(Schema.isInt());
Schema.Number.check(Schema.isGreaterThan(0)); // was positive()
Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 5 })); // OBJECT arg, not (a,b)
Schema.String.check(Schema.isUUID()); // was Schema.UUID
```

## Scalar notes

`String`, `Number`, `Boolean`, `Uint8Array`; UUID =
`Schema.String.check(Schema.isUUID())`. Generated database code uses
`Schema.String` for PostgreSQL `BigInt`, leaving it a `string`.
`Schema.Date` uses native `Date` on both sides (`DateFromSelf` was removed; use
`DateFromString` only when a string codec is wanted).

## Branding & key renaming

```ts
Schema.String.check(Schema.isUUID()).pipe(Schema.brand('UserId'))
Schema.Struct({ ts_name: ... }).pipe(Schema.encodeKeys({ ts_name: 'DB_COL' }))
// encodeKeys replaces v3 propertySignature(...).pipe(fromKey(...)).
// It produces a decodeTo node: `.to` = decoded (semantic) struct, `.from` = encoded.
```

## Annotations & AST (runtime introspection)

```ts
schema.annotate({ [MySymbol]: payload }); // was .annotations({})
SchemaAST.resolve(field.ast)?.[MySymbol]; // read through .check() layers (NOT ast.annotations directly)
SchemaAST.isObjects(ast); // struct guard (was isTypeLiteral)
struct.fields; // public field record; rebuild via Schema.Struct(fields)
```

## Decode / encode

```ts
Schema.decodeUnknownSync(schema)(input);
Schema.encodeSync(schema)(value);
Schema.decodeUnknownOption(schema)(input); // returns Option
```

## What to avoid (v3 → breaks on v4)

- `Schema.Schema<T,E,R>` → use `Schema.Codec`. `Schema.Schema.All` → `Schema.Top`.
- `Schema.asSchema` → `Schema.revealCodec`. `Schema.make(ast)` still exists but prefer
  rebuilding via `Schema.Struct(fields)`.
- Variadic `Union`/`Tuple`/`Literal(a,b)` → array forms.
- `Schema.UUID`, `Schema.DateFromSelf`, `Schema.BigIntFromSelf` → removed/renamed (see above).
- `Schema.propertySignature(...).pipe(Schema.fromKey(...))` → `Schema.encodeKeys`.
- Per-field filters as pipeables (`Schema.int()`, `Schema.between()`) → `.check(Schema.is*)`.

## Generated database contract

Generated `types.ts` owns the operation schema and Kysely contract:

```ts
const DatabaseSchema = VariantSchema.make({
  variants: ['select', 'insert', 'update'],
  defaultVariant: 'select',
});

export interface UserTable {
  created_at: ColumnType<
    (typeof User.Encoded)['created_at'],
    (typeof UserInsert.Encoded)['created_at'],
    Exclude<(typeof UserUpdate.Encoded)['created_at'], undefined>
  >;
}
```

The codec `Type` is the semantic model shape with Prisma field names; its
`Encoded` shape uses physical column names. Both expose PostgreSQL driver-native
leaves. Kysely uses `Encoded`; generated codecs validate values and map keys but
do not coerce scalar values.

Prisma `*-temporal` contract identifiers are adapted to PostgreSQL driver-native
leaves: date/time are strings, timestamp/timestamptz are `Date`, and interval
is `{ months, days, micros }`.
