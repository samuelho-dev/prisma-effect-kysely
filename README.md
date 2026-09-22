# prisma-effect-kysely

Prisma generator for Effect 4 database codecs and native Kysely table contracts.

## Install

Generated files import both peers directly:

```bash
bun add prisma-effect-kysely effect@4.0.0-rc.117 kysely
```

## Setup

```prisma
generator effect_schemas {
  provider = "prisma-effect-kysely"
  output   = "./generated/effect"
}
```

```bash
bunx prisma generate
```

Prisma 8 projects generate from the emitted PostgreSQL contract instead of a
`generator` block:

```bash
bunx prisma contract emit
bunx prisma-effect-kysely contract \
  --contract ./generated/prisma/contract.json \
  --schema ./prisma/contract.prisma \
  --output ./generated/effect
```

The schema path preserves `/// @customType(...)` expressions because Prisma 8
does not include documentation comments in `contract.json`.

The output directory contains `enums.ts`, `types.ts`, and `index.ts`.

## Generated output

Each model has select, insert, and update codecs backed by one private `VariantSchema` field definition. Kysely receives a separate native table interface over the codecs' encoded database view.

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
  createdAt: DatabaseSchema.Field({
    select: Schema.Date,
    insert: Schema.optionalKey(Schema.Date),
    update: Schema.optionalKey(Schema.Date),
  }),
});

export const User = DatabaseSchema.extract(UserFields, 'select');
export type User = typeof User.Type;
export const UserInsert = DatabaseSchema.extract(UserFields, 'insert');
export type UserInsert = typeof UserInsert.Type;
export const UserUpdate = DatabaseSchema.extract(UserFields, 'update');
export type UserUpdate = typeof UserUpdate.Type;

export interface UserTable {
  id: ColumnType<
    Schema.Codec.Encoded<typeof User>['id'],
    Schema.Codec.Encoded<typeof UserInsert>['id'],
    never
  >;
  email: ColumnType<
    Schema.Codec.Encoded<typeof User>['email'],
    Schema.Codec.Encoded<typeof UserInsert>['email'],
    Exclude<Schema.Codec.Encoded<typeof UserUpdate>['email'], undefined>
  >;
  createdAt: ColumnType<
    Schema.Codec.Encoded<typeof User>['createdAt'],
    Schema.Codec.Encoded<typeof UserInsert>['createdAt'],
    Exclude<Schema.Codec.Encoded<typeof UserUpdate>['createdAt'], undefined>
  >;
}

export interface DB {
  User: UserTable;
}
```

For `@map`, decoded codec values keep Prisma's semantic field name while encoded values and Kysely interfaces use the physical column name. `@@map` likewise controls the `DB` table key.

## Consumer usage

```typescript
import { Schema } from 'effect';
import { Kysely, type Insertable, type Selectable, type Updateable } from 'kysely';
import { User, UserInsert, UserUpdate, type DB, type UserId } from './generated/effect';

const db = new Kysely<DB>({ dialect });

type UserRow = Selectable<DB['User']>;
type NewUserRow = Insertable<DB['User']>;
type UserPatch = Updateable<DB['User']>;

const row: UserRow = await db.selectFrom('User').selectAll().executeTakeFirstOrThrow();
const user: User = Schema.decodeUnknownSync(User)(row);
const insert: UserInsert = { email: 'user@example.com' };
const update: UserUpdate = { email: 'next@example.com' };
```

Raw Kysely rows use physical keys and encoded leaf values. Decode through an operation codec for semantic keys, branded IDs, and decoded `bigint` values.

## Field and default ownership

- Nullable fields and database-owned defaults are optional on insert.
- Database-owned defaults are scalar/array literals or `autoincrement()`, `dbgenerated()`, and `now()`.
- Prisma Client defaults (`uuid()`, `cuid()`, `ulid()`, and `nanoid()`), missing DMMF default payloads, unknown functions, and bare `@updatedAt` remain required on insert. Kysely does not run Prisma Client defaults.
- A field with `@updatedAt` and a recognized database default is optional on insert and remains updateable.
- Every primary-key component, including every field in a composite `@@id`, is absent from update codecs and has Kysely update type `never`.
- Optional values use `Schema.NullOr`; omission and explicit `null` are distinct, and explicit `undefined` is rejected.
- Relations and unsupported fields are excluded. Foreign-key scalars use the target model's branded ID schema.

## Type mappings

| Prisma      | Effect 4 database codec                | Encoded database value |
| ----------- | -------------------------------------- | ---------------------- |
| String      | `Schema.String`                        | `string`               |
| UUID string | `Schema.String.check(Schema.isUUID())` | `string`               |
| Int         | `Schema.Int`                           | `number`               |
| Float       | `Schema.Number`                        | `number`               |
| BigInt      | `Schema.BigIntFromString`              | `string`               |
| Decimal     | `Schema.String`                        | `string`               |
| Boolean     | `Schema.Boolean`                       | `boolean`              |
| DateTime    | `Schema.Date`                          | native `Date`          |
| Json        | `Schema.Json`                          | JSON value             |
| Bytes       | `Schema.Uint8Array`                    | `Uint8Array`           |
| Enum        | native enum + `Schema.Enum`            | mapped enum value      |

Arrays use readonly `Schema.Array(type)`. Nullable values use `Schema.NullOr(type)`. Date codecs reject ISO strings at this database boundary.

## UUID detection

A string column is a UUID only when Prisma's DMMF reports `@db.Uuid`, either through `field.nativeType` or the `/// @db.Uuid` documentation marker. Field-name inference is intentionally unsupported because external text IDs such as Stripe `acct_…` and `cus_…` values are not UUIDs.

## Custom type overrides

`@customType(...)` is emitted verbatim and must be an Effect 4 expression already in generated scope:

```prisma
model User {
  /// @customType(Schema.String.check(Schema.isPattern(/@/)))
  email String @unique

  /// @customType(Schema.Number.check(Schema.isGreaterThan(0)))
  age Int

  /// @customType(Schema.Array(Schema.Number).check(Schema.isLengthBetween(3, 3)))
  coordinates Int[]
}
```

## Implicit many-to-many tables

Prisma's physical `A`/`B` columns decode to semantic snake-case keys. Join tables expose select and insert codecs only; both insert fields are required and branded.

```typescript
const ProductTagsFields = DatabaseSchema.Struct({
  product_id: DatabaseSchema.Field({ select: ProductId, insert: ProductId }),
  product_tag_id: DatabaseSchema.Field({ select: ProductTagId, insert: ProductTagId }),
});

export const ProductTags = DatabaseSchema.extract(ProductTagsFields, 'select').pipe(
  Schema.encodeKeys({ product_id: 'A', product_tag_id: 'B' })
);
export type ProductTags = typeof ProductTags.Type;

export const ProductTagsInsert = DatabaseSchema.extract(ProductTagsFields, 'insert').pipe(
  Schema.encodeKeys({ product_id: 'A', product_tag_id: 'B' })
);
export type ProductTagsInsert = typeof ProductTagsInsert.Type;

export interface ProductTagsTable {
  A: ColumnType<
    Schema.Codec.Encoded<typeof ProductTags>['A'],
    Schema.Codec.Encoded<typeof ProductTagsInsert>['A'],
    never
  >;
  B: ColumnType<
    Schema.Codec.Encoded<typeof ProductTags>['B'],
    Schema.Codec.Encoded<typeof ProductTagsInsert>['B'],
    never
  >;
}
```

## Package exports

The package is generator-only:

| Entry                             | Contents                |
| --------------------------------- | ----------------------- |
| `prisma-effect-kysely` executable | Prisma generator binary |
| `prisma-effect-kysely/generator`  | Generator module entry  |

Generated application code never imports `prisma-effect-kysely` at runtime.

## Development

```bash
bun install
bun run test
bun run typecheck
bun run build
bun run prepublishOnly
```

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
