# Prisma Effect Generator

A Prisma generator that creates Effect Schema types from Prisma schema definitions with exact type safety and intelligent UUID detection.

## Features

- ✅ **Type-Safe Generation**: Zero type coercion, complete type safety
- ✅ **Intelligent UUID Detection**: Via `@db.Uuid`, `nativeType`, or field name patterns
- ✅ **Enum Support**: Effect Schema enums with `@map` annotation support
- ✅ **Deterministic Output**: Alphabetically sorted for consistent results
- ✅ **Complete Type Mappings**: All Prisma types mapped to Effect Schema equivalents

## Installation

```bash
bun add prisma-effect-kysely
# or
npm install prisma-effect-kysely
```

## Usage

### 1. Add to schema.prisma

```prisma
generator effect_schemas {
  provider = "prisma-effect-kysely"
  output   = "./generated/effect"
}
```

### 2. Generate Effect Schemas

```bash
npx prisma generate
```

## Output

Generates three files in the configured output directory:

### enums.ts

Effect Schema enums from Prisma enums with exact literal types:

```typescript
export const UserRoleSchema = Schema.Literal('admin', 'user', 'guest');
```

### types.ts

Effect Schema structs from Prisma models with Kysely integration (v5.0 direct exports):

```typescript
import { Schema } from "effect";
import { columnType, generated, Selectable } from "prisma-effect-kysely";

// EXPORTED - Branded ID schema
export const UserId = Schema.UUID.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

// EXPORTED - Model schema (direct export)
export const User = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  email: Schema.String,
  createdAt: generated(Schema.DateFromSelf),
});
export type User = typeof User;

// EXPORTED - Kysely DB interface with Selectable<Model>
export interface DB {
  User: Selectable<User>;
}
```

### index.ts

Re-exports all generated types for easy importing

## Consumer Usage (v5.0)

Branded ID types are exported directly. Use type utilities from `prisma-effect-kysely` for other types:

```typescript
import { Selectable, Insertable, Updateable } from "prisma-effect-kysely";
import { User, UserId, DB } from "./generated";

// Branded ID type - direct import (no utility needed)
function getUser(id: UserId): Promise<User> { ... }

// Extract types using utilities (Kysely-native pattern)
type UserSelect = Selectable<typeof User>;
type UserInsert = Insertable<typeof User>;
type UserUpdate = Updateable<typeof User>;

// Use with Kysely
import { Kysely } from 'kysely';

const db = new Kysely<DB>({ ... });

// Type-safe queries
const user = await db.selectFrom('User').selectAll().executeTakeFirst();
```

**Naming Convention**: All exported schemas use PascalCase, regardless of the Prisma model naming convention:

- Model `User` → `export const User`
- Model `session_preference` → `export const SessionPreference`

## Type Mappings

| Prisma Type | Effect Schema Type  | Notes                            |
| ----------- | ------------------- | -------------------------------- |
| String      | `Schema.String`     | `Schema.UUID` for id fields      |
| Int / Float | `Schema.Number`     | With `Schema.int()` for integers |
| BigInt      | `Schema.BigInt`     | Exact bigint type                |
| Decimal     | `Schema.String`     | String for precision             |
| Boolean     | `Schema.Boolean`    | -                                |
| DateTime    | `Schema.DateFromSelf` | Native Date for Kysely           |
| Json        | `Schema.Unknown`    | Safe unknown type                |
| Bytes       | `Schema.Uint8Array` | -                                |
| Enum        | Enum Schema         | With `Schema.Literal` values     |

## UUID Detection

The generator intelligently detects UUID fields through multiple strategies (in order):

1. **Native Type**: `@db.Uuid` attribute (most reliable)
2. **Documentation**: `@db.Uuid` in field comments
3. **Default Value**: `dbgenerated("gen_random_uuid()")` or similar
4. **Field Name Patterns**: `id`, `*_id`, `*_uuid`, `uuid`

Example:

```prisma
model User {
  id        String @id @db.Uuid @default(dbgenerated("gen_random_uuid()"))
  userId    String @db.Uuid  // Detected via native type
  productId String           // Detected via field name pattern
}
```

## Development

This project uses **Bun** as the sole package manager.

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage

# Type check
bun run typecheck

# Build
bun run build
```

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for automated versioning and publishing:

### Creating a Release

1. **Add a changeset** for your changes:

   ```bash
   bun changeset
   ```

   Follow the prompts to describe your changes (patch/minor/major).

2. **Commit the changeset**:

   ```bash
   git add .changeset/
   git commit -m "docs: add changeset for [feature/fix]"
   git push
   ```

3. **Automated Release PR**: The CI will automatically:
   - Create or update a "Version Packages" PR
   - Update `package.json` version
   - Update `CHANGELOG.md`

4. **Publish**: When you merge the "Version Packages" PR:
   - CI automatically publishes to npm using Bun
   - Creates a git tag (e.g., `v1.15.0`)
   - Creates a GitHub release with auto-generated notes

### Manual Publishing (if needed)

```bash
# Build and run all checks
bun run prepublishOnly

# Publish
bun publish --access public
```

## Releasing (CI/CD)

This repo uses **Changesets** to automate versioning, changelog updates, npm publishing, git tags, and GitHub Releases.

### For PR authors

Add a changeset for any user-facing change:

```bash
bun changeset
```

Commit the generated file in `.changeset/`.

### What happens on `main`

- When changesets land on `main`, CI opens/updates a **Version Packages** PR.
- When the **Version Packages** PR is merged, CI:
  - updates `package.json` + `CHANGELOG.md`
  - publishes to npm (with provenance)
  - creates/pushes `vX.Y.Z` tag
  - creates a GitHub Release

### Required GitHub repo secrets

- `NPM_TOKEN`: npm access token with permission to publish `prisma-effect-kysely`

## Architecture

### Type Safety

This generator uses **EXACT DMMF types** from Prisma and implements **zero type coercion**:

- Uses `FieldDefault` type matching Prisma's exact structure
- Type-safe validation with structural typing
- No `as` assertions or unsafe casts
- Complete TypeScript strict mode compliance

### Generated Code Quality

- **Alphabetically sorted** fields and models for consistency
- **Branded types** for UUIDs via `Schema.UUID`
- **Exact type inference** - no widening to `any` or `unknown`
- **Auto-generated headers** with timestamps and edit warnings

## Custom Type Overrides

Use `@customType` annotations to override Effect Schema types for **Prisma-supported fields**:

```prisma
model User {
  /// @customType(Schema.String.pipe(Schema.email()))
  email String @unique

  /// @customType(Schema.Number.pipe(Schema.positive()))
  age Int

  /// @customType(Schema.String.pipe(Schema.brand('UserId')))
  userId String
}
```

**Supported for**: All Prisma scalar types (String, Int, Float, Boolean, DateTime, BigInt, Decimal, Json, Bytes)

**Use cases**:

- Email/URL validation
- Number constraints (positive, range, etc.)
- Custom branded types
- Refined string patterns

**Examples**:

```typescript
// Generated from Prisma schema with @customType annotations
export const _User = Schema.Struct({
  email: Schema.String.pipe(Schema.email()),
  age: Schema.Number.pipe(Schema.positive()),
  userId: Schema.String.pipe(Schema.brand('UserId')),
});
```

## Troubleshooting

### Generator Not Found

If you're developing the generator locally, make sure to build it first:

```bash
npm run build
```

Then reference it in your schema.prisma:

```prisma
generator effect_schemas {
  provider = "node ./path/to/dist/generator.js"
  output   = "./generated/effect"
}
```

### Wrong Types Generated

Check the generator output in console:

```
[Effect Generator] Starting generation...
[Effect Generator] Processing 15 models, 3 enums
[Effect Generator] ✓ Generated to ../../libs/types/storage/src/lib/effect
```

### UUID Not Detected

Add explicit `@db.Uuid` attribute:

```prisma
userId String @db.Uuid
```

## License

MIT
