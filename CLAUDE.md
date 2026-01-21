---
scope: project
updated: 2026-01-21
relates_to:
  - src/kysely/helpers.ts
  - src/effect/generator.ts
  - src/generator/orchestrator.ts
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Prisma generator that creates Effect Schema types from Prisma schema definitions with exact type safety, intelligent UUID detection, and branded ID types.

## Commands

This project uses **Bun** as the sole package manager.

### Build
```bash
bun run build
```
Compiles TypeScript to dist/ directory using tsc

### Testing
```bash
bun run test             # Run all tests (Vitest)
bun run test:watch       # Run tests in watch mode
bun run test:coverage    # Run tests with coverage report
```

To run a single test file:
```bash
bun run test src/__tests__/code-generation.test.ts
```

### Type Checking
```bash
bun run typecheck
```
Runs TypeScript compiler in noEmit mode

### Pre-publish
```bash
bun run prepublishOnly
```
Runs lint, typecheck, tests, and build in sequence

### Install Dependencies
```bash
bun install
```

## Architecture

### Entry Point and Flow
1. **src/generator/index.ts**: Prisma generator handler entry point
   - Exports manifest with version and default output path
   - Delegates generation to `GeneratorOrchestrator`

2. **src/generator/orchestrator.ts**: Main orchestrator class
   - `GeneratorOrchestrator`: Coordinates all generation steps
   - Validates output path from generator options
   - Manages file generation in parallel for performance
   - Logs generation progress and statistics

3. **Generator Classes** (src/effect/):
   - `EffectGenerator`: Creates Effect Schema types with branded IDs
   - `generateEnumsFile`: Creates enums.ts with Effect Literal schemas
   - `generateJoinTableSchema`: Creates schemas for M2M join tables

4. **Kysely Integration** (src/kysely/):
   - `KyselyGenerator`: Creates DB interface
   - `helpers.ts`: Runtime helpers and type utilities

5. **Utility Classes**:
   - `FileManager` (src/utils/file-manager.ts): Handles file system operations
   - `templates.ts` (src/utils/templates.ts): Uses Prettier to format generated code

### Output Structure (Simplified v5.0)
The generator creates three files in the configured output directory:

- **enums.ts**: Effect Schema Literal types for Prisma enums (supports @map)
- **types.ts**: Effect Schema Struct types for Prisma models with:
  - **Exported** branded ID schemas (e.g., `export const UserId = Schema.UUID.pipe(Schema.brand("UserId"))`)
  - **Exported** branded ID types (e.g., `export type UserId = typeof UserId.Type`)
  - **Exported** model schemas directly (e.g., `export const User = Schema.Struct({...})`)
  - **Exported** model type aliases (e.g., `export type User = typeof User`)
  - **Exported** Kysely `DB` interface with `Selectable<Model>` pattern
- **index.ts**: Re-exports all generated types

### Direct Exports API (v5.0)

Schemas are exported directly without wrapper functions or underscore prefixes:

```typescript
import { Schema } from "effect";
import { columnType, generated, Selectable } from "prisma-effect-kysely";

// EXPORTED - Branded ID schema
export const UserId = Schema.UUID.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

// EXPORTED - Model schema (direct export, no underscore prefix)
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

### Consumer Type Pattern (v5.0)

Branded ID types are exported directly. Other types use utilities from `prisma-effect-kysely`:

```typescript
import { Selectable, Insertable, Updateable } from "prisma-effect-kysely";
import { User, UserId, DB } from "./generated";

// Branded ID type - direct import
function getUser(id: UserId): Promise<User> { ... }

// Other types via utilities (matches Kysely's native pattern)
type UserSelect = Selectable<typeof User>;
type UserInsert = Insertable<typeof User>;
type UserUpdate = Updateable<typeof User>;
```

### Generated Schema Structure (v5.0)

Each model generates direct exports:

```typescript
// EXPORTED: Branded ID schema
export const UserId = Schema.UUID.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

// EXPORTED: Model schema (direct, no wrapper)
export const User = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  email: Schema.String,
  createdAt: generated(Schema.DateFromSelf),
});
export type User = typeof User;
```

### Kysely Integration
The generator includes deep Kysely integration for type-safe database operations:

**Generated Schemas (v5.0)**: Each model generates:
- **Exported** branded ID schema (e.g., `export const UserId = ...`)
- **Exported** branded ID type (e.g., `export type UserId = ...`)
- **Exported** model schema directly (e.g., `export const User = Schema.Struct({...})`)
- **Exported** model type alias (e.g., `export type User = typeof User`)

Consumers use type utilities from `prisma-effect-kysely`:
- `Selectable<typeof User>`: Extract SELECT type
- `Insertable<typeof User>`: Extract INSERT type (omits generated/read-only fields)
- `Updateable<typeof User>`: Extract UPDATE type (all fields optional except read-only)

**Field Behavior**:
- Fields with `@default` or `@updatedAt`: Wrapped in `generated()` - omitted from insert, optional in update
- ID fields with `@default`: Wrapped in `columnType(type, Schema.Never, Schema.Never)` - read-only
- Optional fields: Wrapped in `Schema.NullOr(type)`
- Foreign keys: Use branded ID type from target model

**Runtime Helpers** (imported from `prisma-effect-kysely`):
- `columnType(select, insert, update)`: Custom column type definitions for Kysely compatibility
- `generated(schema)`: Marks fields as database-generated (omitted from insert, optional in update)

**Type Utilities** (imported from `prisma-effect-kysely`):
- `Selectable<typeof Model>`: Extract full SELECT type from schema
- `Insertable<typeof Model>`: Extract INSERT type from schema
- `Updateable<typeof Model>`: Extract UPDATE type from schema

**Database Errors** (from `prisma-effect-kysely/error`):
- `NotFoundError`: Query returned no results
- `QueryError`: Database query failed
- `QueryParseError`: Schema validation failed
- `DatabaseError`: Union of all error types

**DB Interface (v5.0)**: Uses `Selectable<Model>` pattern:
```typescript
export interface DB {
  User: Selectable<User>;
  Post: Selectable<Post>;
  // Uses @@map directive if present, otherwise model name
}
```

**Implicit Many-to-Many Join Tables (v5.0)**: Direct exports with semantic names:
- **Database Columns**: Prisma requires `A` and `B` columns (alphabetically ordered)
- **TypeScript Fields**: Generated with semantic snake_case names (e.g., `product_id`, `product_tag_id`)
- **Mapping**: Uses Effect Schema's `propertySignature` with `fromKey` to map semantic names to A/B
- **Example**:
  ```typescript
  // Database: _ProductToProductTag with columns A, B
  // Generated TypeScript (v5.0):

  // EXPORTED - Direct schema with semantic names
  export const ProductToProductTag = Schema.Struct({
    product_id: Schema.propertySignature(
      columnType(Schema.UUID, Schema.Never, Schema.Never)
    ).pipe(Schema.fromKey("A")),
    product_tag_id: Schema.propertySignature(
      columnType(Schema.UUID, Schema.Never, Schema.Never)
    ).pipe(Schema.fromKey("B")),
  });
  export type ProductToProductTag = typeof ProductToProductTag;
  ```
- **Benefits**:
  - Developer-friendly semantic names in TypeScript
  - Maintains Prisma A/B database compatibility
  - Type-safe bidirectional transformation
  - Follows snake_case convention for database identifiers

### Branded ID Types

Each model with an `@id` field gets a branded ID schema:

```typescript
// Generated (v5.0)
export const UserId = Schema.UUID.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const PostId = Schema.UUID.pipe(Schema.brand("PostId"));
export type PostId = typeof PostId.Type;

// Consumer usage - branded IDs prevent mixing
import { UserId, PostId } from "./generated";

getUser(postId);  // COMPILE ERROR - branded types prevent mixing
```

### UUID Detection Strategy
The generator uses a 3-tier detection strategy (in priority order):

1. **Native Type** (`field.nativeType[0] === 'Uuid'`): Most reliable, from `@db.Uuid`
2. **Documentation** (`field.documentation?.includes('@db.Uuid')`): From field comments
3. **Field Name Patterns** (fallback): Regex patterns for `id`, `*_id`, `*_uuid`, `uuid`

Implemented in `isUuidField()` (src/prisma/type.ts)

### Type Safety Principles

**Zero Type Coercion**: The generator uses exact DMMF types from Prisma with no `as` assertions or unsafe casts.

- All UUID detection uses Prisma's native DMMF type information
- No custom type guards or structural validation needed
- Field type annotations (`@db.Uuid`) are the source of truth

**Strict Mode**: Full TypeScript strict mode compliance (tsconfig.json)

### Package Exports

The package provides multiple entry points via package.json exports:

1. **Main Generator** (`prisma-effect-kysely`):
   - Entry: `dist/generator/index.js`
   - Used in Prisma schema `provider` field
   - Generates Effect Schema types from Prisma models
   - Re-exports type utilities: `Selectable`, `Insertable`, `Updateable`
   - Re-exports runtime helpers: `columnType`, `generated`, `getSchemas`

2. **Kysely Helpers** (`prisma-effect-kysely/kysely`):
   - Runtime helpers for Kysely integration
   - Exports: `getSchemas`, `columnType`, `generated`
   - Type utilities: `Selectable`, `Insertable`, `Updateable`

3. **Error Types** (`prisma-effect-kysely/error`):
   - Database error types for Effect error handling
   - Exports: `NotFoundError`, `QueryError`, `QueryParseError`, `DatabaseError`

4. **Runtime** (`prisma-effect-kysely/runtime`):
   - Re-exports all runtime utilities
   - Convenience import for both helpers and errors

### Type Mappings

| Prisma Type | Effect Schema Type | Notes |
|-------------|-------------------|-------|
| String | `Schema.String` | `Schema.UUID` for UUID fields |
| Int / Float | `Schema.Number` | - |
| BigInt | `Schema.BigInt` | - |
| Decimal | `Schema.String` | For precision |
| Boolean | `Schema.Boolean` | - |
| DateTime | `Schema.DateFromSelf` | - |
| Json | `Schema.Unknown` | Safe unknown type |
| Bytes | `Schema.Uint8Array` | - |
| Enum | Enum Schema | Uses imported enum |

Arrays: `Schema.Array(baseType)`
Optional: `Schema.NullOr(baseType)`

### Deterministic Output

All models and fields are alphabetically sorted to ensure consistent generation across runs.

## File Structure

```
prisma-effect-kysely/
+-- src/
|   +-- effect/
|   |   +-- generator.ts      # Effect schema generation with branded IDs
|   |   +-- enum.ts           # Enum schema generation
|   |   +-- join-table.ts     # M2M join table schemas
|   |   +-- type.ts           # Field type mapping
|   +-- generator/
|   |   +-- index.ts          # Prisma generator entry point
|   |   +-- orchestrator.ts   # Generation orchestration
|   |   +-- config.ts         # Generator configuration
|   +-- kysely/
|   |   +-- generator.ts      # Kysely DB interface generation
|   |   +-- helpers.ts        # Runtime helpers + type utilities
|   |   +-- type.ts           # Kysely type mapping
|   +-- prisma/
|   |   +-- generator.ts      # DMMF parsing
|   |   +-- relation.ts       # Relation detection
|   |   +-- type.ts           # Prisma type utilities
|   +-- utils/
|   |   +-- codegen.ts        # Code generation utilities
|   |   +-- file-manager.ts   # File system operations
|   |   +-- naming.ts         # Naming conventions
|   +-- __tests__/            # Test suites
+-- dist/                     # Compiled output
+-- CLAUDE.md                 # This file
+-- README.md                 # User documentation
```

## Development Notes

- Generator must be built before running `prisma generate`
- The generator filters out internal models (those starting with `_`)
- All generated files include auto-generated headers with timestamps and edit warnings
- Field defaults are validated using exact DMMF type structure, not string parsing
- Relation fields are excluded from generated schemas - only scalar and enum fields are included
- Test fixtures are located in `src/__tests__/fixtures/test.prisma`

## For Future Claude Code Instances (v5.0)

**Critical v5.0 Principles**:
- Run `bun run test` before making changes to verify baseline
- **NO underscore prefixes** - Direct exports only: `export const User = Schema.Struct({...})`
- **NO wrapper functions** - No `getSchemas()` in generated code (though it's still in the runtime API)
- **NO internal table interfaces** - DB interface uses `Selectable<Model>` directly
- Branded ID schemas are exported: `export const UserId = Schema.UUID.pipe(Schema.brand("UserId"))`
- Branded ID types are exported: `export type UserId = typeof UserId.Type`
- Consumers use type utilities: `Selectable<typeof User>`, NOT `UserSelect`
- Join tables do NOT get branded IDs (they use composite keys)
- DB interface uses `Selectable<Model>` pattern: `User: Selectable<User>`
- Fields with `@updatedAt` are wrapped with `generated()` (same as `@default`)
