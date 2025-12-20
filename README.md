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
npm install prisma-effect-kysely
# or
pnpm add prisma-effect-kysely
# or
yarn add prisma-effect-kysely
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
export const UserRole = Schema.Literal('admin', 'user', 'guest');
export type UserRole = Schema.Schema.Type<typeof UserRole>;
```

### types.ts

Effect Schema structs from Prisma models:

```typescript
export const User = Schema.Struct({
  id: Schema.UUID,
  email: Schema.String,
  name: Schema.optional(Schema.String),
  role: UserRole,
  createdAt: Schema.Date,
});
export type User = Schema.Schema.Type<typeof User>;
```

**Naming Convention**: All exported schemas and types use PascalCase, regardless of the Prisma model naming convention:

- Model `User` → `User`, `UserSelect`, `UserInsert`
- Model `session_preference` → `SessionPreference`, `SessionPreferenceSelect`, `SessionPreferenceInsert`

This ensures consistent TypeScript identifier naming while preserving the original model names for internal schemas.

### index.ts

Re-exports all generated types for easy importing

## Type Mappings

| Prisma Type | Effect Schema Type  | Notes                            |
| ----------- | ------------------- | -------------------------------- |
| String      | `Schema.String`     | `Schema.UUID` for id fields      |
| Int / Float | `Schema.Number`     | With `Schema.int()` for integers |
| BigInt      | `Schema.BigInt`     | Exact bigint type                |
| Decimal     | `Schema.String`     | String for precision             |
| Boolean     | `Schema.Boolean`    | -                                |
| DateTime    | `Schema.Date`       | -                                |
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

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:coverage

# Type check
pnpm run typecheck

# Build
pnpm run build
```

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for automated versioning and publishing:

### Creating a Release

1. **Add a changeset** for your changes:

   ```bash
   pnpm changeset
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
pnpm run prepublishOnly

# Publish with Bun (recommended)
bun publish --access public
```

## Releasing (CI/CD)

This repo uses **Changesets** to automate versioning, changelog updates, npm publishing, git tags, and GitHub Releases.

### For PR authors

Add a changeset for any user-facing change:

```bash
pnpm changeset
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
