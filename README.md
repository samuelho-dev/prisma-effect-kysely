# prisma-effect-kysely

Prisma generator for Effect 4 database codecs and native Kysely table contracts.

## Install

Generated files import both peers directly:

```bash
bun add prisma-effect-kysely effect@4.0.0-rc.117 kysely@^0.29.6
```

## Setup

Generate from Prisma 8's emitted PostgreSQL contract:

```bash
bunx prisma contract emit
bunx prisma-effect-kysely contract \
  --contract ./generated/prisma/contract.json \
  --schema ./prisma/contract.prisma \
  --output ./generated/effect
```

The schema path preserves `/// @customType(...)` expressions because Prisma 8 does not include documentation comments in `contract.json`.

The output directory contains `enums.ts`, `types.ts`, and `index.ts`.

Pass `--multi-domain` to write those three files for each Prisma namespace at
`<output>/<namespace>/src/generated`. Every domain writes `enums.ts`, and each
`types.ts` declares every ID brand it references. It does not scaffold libraries
or projects.

Each Prisma enum emits a native TypeScript enum for named application values and
a PascalCase Effect codec. If both names would collide, the TypeScript enum gets
an `Enum` suffix, such as `StatusEnum.ACTIVE`, while `Status` remains the codec.

## Generated output

Each model has select, insert, and update codecs backed by one private `VariantSchema` field definition. Codec `Type` values use Prisma's semantic field names with driver-native leaves; codec `Encoded` values use physical database keys with those same leaves. Kysely receives a separate native table interface using the encoded values.

```typescript
import { Schema } from 'effect';
import { VariantSchema } from 'effect/unstable/schema';
import type { ColumnType } from 'kysely';

const DatabaseSchema = VariantSchema.make({
  variants: ['select', 'insert', 'update'],
  defaultVariant: 'select',
});

export const UserId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand('UserId'));
export type UserId = typeof UserId.Type;

const UserFields = DatabaseSchema.Struct({
  id: DatabaseSchema.Field({
    select: UserId,
    insert: Schema.optionalKey(UserId),
  }),
  email: DatabaseSchema.Field({
    select: Schema.String,
    insert: Schema.String,
    update: Schema.optionalKey(Schema.String),
  }),
});

export const User = DatabaseSchema.extract(UserFields, 'select');
export type User = typeof User.Type;
export const UserInsert = DatabaseSchema.extract(UserFields, 'insert');
export type UserInsert = typeof UserInsert.Type;
export const UserUpdate = DatabaseSchema.extract(UserFields, 'update');
export type UserUpdate = typeof UserUpdate.Type;

export interface UserTable {
  id: ColumnType<(typeof User.Encoded)['id'], (typeof UserInsert.Encoded)['id'], never>;
  email: ColumnType<
    (typeof User.Encoded)['email'],
    (typeof UserInsert.Encoded)['email'],
    Exclude<(typeof UserUpdate.Encoded)['email'], undefined>
  >;
}

export interface DB {
  User: UserTable;
}
```

For `@map`, codec `Type` values keep Prisma's semantic field name while codec `Encoded` values and Kysely interfaces use the physical column name. `@@map` likewise controls the `DB` table key.

If multiple namespaces use the same physical table name, single-output mode
qualifies only those colliding `DB` keys as `<namespace>.<table>`. Multi-domain
output keeps bare table names because each namespace has its own `DB`.

## Consumer usage

```typescript
import { Kysely, type Insertable, type Selectable, type Updateable } from 'kysely';
import type { DB } from './generated/effect';

const db = new Kysely<DB>({ dialect });

type UserRow = Selectable<DB['User']>;
type NewUserRow = Insertable<DB['User']>;
type UserPatch = Updateable<DB['User']>;

const row: UserRow = await db.selectFrom('User').selectAll().executeTakeFirstOrThrow();
const insert: NewUserRow = { email: 'user@example.com' };
const update: UserPatch = { email: 'next@example.com' };
```

Kysely rows retain physical database keys and driver-native leaves. PostgreSQL
`BigInt` is a string in Kysely and in generated codec `Type`/`Encoded` values.
The generated codecs can validate values and map `@map` keys, but they do not
coerce scalar values before or after a query.

```typescript
await db.insertInto('User').values(insert).execute();
```

## Field and default ownership

- Nullable fields and database-owned defaults are optional on insert.
- Database-owned defaults are scalar/array literals or `autoincrement()`, `dbgenerated()`, and `now()`.
- Prisma Client defaults (`uuid()`, `cuid()`, `ulid()`, and `nanoid()`), missing DMMF default payloads, unknown functions, and bare `@updatedAt` remain required on insert. Kysely does not run Prisma Client defaults.
- A field with `@updatedAt` and a recognized database default is optional on insert and remains updateable.
- Every primary-key component, including every field in a composite `@@id`, is absent from update codecs and has Kysely update type `never`.
- Optional values use `Schema.NullOr`; omission and explicit `null` are distinct, and explicit `undefined` is rejected.
- Relations and unsupported fields are excluded. Foreign-key scalars use the target model's branded ID schema.

## Type mappings

| Prisma / PostgreSQL codec | Generated codec and Kysely leaf                   |
| ------------------------- | ------------------------------------------------- |
| String                    | `Schema.String` / `string`                        |
| UUID string               | `Schema.String.check(Schema.isUUID())` / `string` |
| Int                       | `Schema.Int` / `number`                           |
| Float                     | `Schema.Number` / `number`                        |
| BigInt                    | `Schema.String` / `string`                        |
| Decimal                   | `Schema.String` / `string`                        |
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
and interval is `{ months, days, micros }`. Generated codecs do not perform
value coercion.

## UUID detection

A string column is a UUID only when Prisma's DMMF reports `@db.Uuid`, either through `field.nativeType` or the `/// @db.Uuid` documentation marker. Field-name inference is intentionally unsupported because external text IDs such as Stripe `acct_…` and `cus_…` values are not UUIDs.

## Custom type overrides

`@customType(...)` defines only the scalar refinement and must be an Effect 4 expression already in generated scope. The generator applies Prisma list and nullability metadata around it:

```prisma
model User {
  /// @customType(Schema.String.pipe(Schema.brand('EmailAddress')))
  email String @unique

  /// @customType(Schema.Number.pipe(Schema.brand('PositiveInt')))
  age Int

  /// @customType(Schema.Number.pipe(Schema.brand('Coordinate')))
  coordinates Int[]
}
```

For example, `String? @customType(Schema.String.pipe(Schema.brand('EmailAddress')))` emits `Schema.NullOr(Schema.String.pipe(Schema.brand('EmailAddress')))`, while `Int[] @customType(Schema.Number.pipe(Schema.brand('Coordinate')))` emits `Schema.Array(Schema.Number.pipe(Schema.brand('Coordinate')))`. Do not put `Schema.NullOr` or `Schema.Array` in the annotation.

## Join models

Prisma 8 contract models are emitted as ordinary models, including explicit join
models whose physical table names begin with `_`. They receive the standard
select, insert, update, table-interface, and `DB` entries; table names alone
never cause model removal or relation synthesis.

## Package exports

The package exposes the `prisma-effect-kysely` contract generator executable. Generated application code never imports `prisma-effect-kysely` at runtime.

## Development

```bash
bun install
bun run test
bun run typecheck
bun run build
bun run prepublishOnly
```

Type checking and builds run TypeScript 7.0.2 through `@typescript/native`. The unscoped `typescript` 6 dependency supplies the compiler API required by typescript-eslint because TypeScript 7.0 intentionally ships no programmatic API; it is not the active compiler.

## Releasing

Uses [Changesets](https://github.com/changesets/changesets):

```bash
bun changeset
git add .changeset/ && git commit -m "docs: changeset"
git push
```

CI opens a Version Packages PR. Merging it publishes to npm, creates the git tag, and creates a GitHub release.

## License

MIT
