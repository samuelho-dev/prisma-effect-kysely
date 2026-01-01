# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Prisma generator that creates Effect Schema types from Prisma schema definitions with exact type safety, intelligent UUID detection, and branded ID types.

## Commands

### Build
```bash
npm run build
```
Compiles TypeScript to dist/ directory using tsconfig.lib.json

### Testing
```bash
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
```

To run a single test file:
```bash
npm test -- src/__tests__/generator.test.ts
```

### Type Checking
```bash
npm run typecheck
```
Runs TypeScript compiler in noEmit mode

### Pre-publish
```bash
npm run prepublishOnly
```
Runs typecheck, tests, and build in sequence (runs automatically before publishing)

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
   - `KyselyGenerator`: Creates Kysely table interfaces and DB interface
   - `helpers.ts`: Runtime helpers and type utilities

5. **Utility Classes**:
   - `FileManager` (src/utils/file-manager.ts): Handles file system operations
   - `templates.ts` (src/utils/templates.ts): Uses Prettier to format generated code

### Output Structure
The generator creates three files in the configured output directory:

- **enums.ts**: Effect Schema Literal types for Prisma enums (supports @map)
- **types.ts**: Effect Schema Struct types for Prisma models with:
  - Kysely table interfaces (e.g., `UserTable`)
  - Base schemas prefixed with `_` (e.g., `_User`)
  - Branded ID schemas (e.g., `UserIdSchema`)
  - Unified operational schemas (e.g., `User = { ...getSchemas(_User), Id: UserIdSchema }`)
  - Kysely `DB` interface with table mappings
- **index.ts**: Re-exports all generated types

### Consumer Type Pattern (v2.1+)

**No type exports in generated code**. Consumers use type utilities from `prisma-effect-kysely`:

```typescript
import { Selectable, Insertable, Updateable, Id } from "prisma-effect-kysely";
import { User, DB } from "./generated";

// Types via utilities (matches Kysely's native pattern)
type UserSelect = Selectable<typeof User>;
type UserInsert = Insertable<typeof User>;
type UserUpdate = Updateable<typeof User>;
type UserId = Id<typeof User>;
```

### Generated Schema Structure

Each model generates:

```typescript
// Branded ID schema (for models with @id field)
const UserIdSchema = Schema.UUID.pipe(Schema.brand("UserId"));

// Base schema with field definitions
export const _User = Schema.Struct({
  id: columnType(UserIdSchema, Schema.Never, Schema.Never),
  email: Schema.String,
  createdAt: generated(Schema.DateFromSelf),
});

// Unified export with operational schemas + branded Id
export const User = {
  ...getSchemas(_User),
  Id: UserIdSchema,
} as const;
```

### Kysely Integration
The generator includes deep Kysely integration for type-safe database operations:

**Generated Schemas**: Each model generates:
- Kysely table interface `ModelTable` with ColumnType wrappers
- Base schema `_ModelName` with raw field definitions
- Branded ID schema `ModelNameIdSchema` (if model has @id)
- Operational schemas via `getSchemas(_ModelName)`:
  - `ModelName.Selectable`: Schema for SELECT queries
  - `ModelName.Insertable`: Schema for INSERT queries (fields with `@default` omitted)
  - `ModelName.Updateable`: Schema for UPDATE queries (all fields optional)
- Branded ID: `ModelName.Id`

**Field Behavior**:
- Fields with `@default`: Wrapped in `generated()` - omitted from insert schema
- ID fields with `@default`: Wrapped in `columnType(type, Schema.Never, Schema.Never)` - read-only
- Optional fields: Wrapped in `Schema.Union(type, Schema.Undefined)`

**Runtime Helpers** (imported from `prisma-effect-kysely`):
- `getSchemas(baseSchema)`: Creates Selectable/Insertable/Updateable schemas
- `columnType(select, insert, update)`: Custom column type definitions
- `generated(schema)`: Marks fields as database-generated

**Type Utilities** (imported from `prisma-effect-kysely`):
- `Selectable<T>`: Extract SELECT type from schema
- `Insertable<T>`: Extract INSERT type from schema
- `Updateable<T>`: Extract UPDATE type from schema
- `Id<T>`: Extract branded ID type from schema

**Database Errors** (from `prisma-effect-kysely/error`):
- `NotFoundError`: Query returned no results
- `QueryError`: Database query failed
- `QueryParseError`: Schema validation failed
- `DatabaseError`: Union of all error types

**DB Interface**: Generated Kysely database interface with table mappings:
```typescript
export interface DB {
  User: UserTable;
  Post: PostTable;
  // Uses @@map directive if present, otherwise model name
}
```

**Implicit Many-to-Many Join Tables**: The generator automatically detects and generates schemas for Prisma's implicit M2M relations:
- **Database Columns**: Prisma requires `A` and `B` columns (alphabetically ordered)
- **TypeScript Fields**: Generated with semantic snake_case names (e.g., `product_id`, `product_tag_id`)
- **Mapping**: Uses Effect Schema's `propertySignature` with `fromKey` to map semantic names to A/B
- **Example**:
  ```typescript
  // Database: _ProductToProductTag with columns A, B
  // Generated TypeScript:
  export const _ProductToProductTag = Schema.Struct({
    product_id: Schema.propertySignature(columnType(Schema.UUID, Schema.Never, Schema.Never)).pipe(Schema.fromKey("A")),
    product_tag_id: Schema.propertySignature(columnType(Schema.UUID, Schema.Never, Schema.Never)).pipe(Schema.fromKey("B")),
  });

  export const ProductToProductTag = getSchemas(_ProductToProductTag);
  ```
- **Benefits**:
  - Developer-friendly semantic names in TypeScript
  - Maintains Prisma A/B database compatibility
  - Type-safe bidirectional transformation
  - Follows snake_case convention for database identifiers

### Branded ID Types

Each model with an `@id` field gets a branded ID schema for nominal type safety:

```typescript
// Generated
const UserIdSchema = Schema.UUID.pipe(Schema.brand("UserId"));
const PostIdSchema = Schema.UUID.pipe(Schema.brand("PostId"));

// Consumer usage - branded IDs prevent mixing
type UserId = Id<typeof User>;  // Brand prevents assignment to PostId
type PostId = Id<typeof Post>;

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
   - Re-exports type utilities: `Selectable`, `Insertable`, `Updateable`, `Id`
   - Re-exports runtime helpers: `columnType`, `generated`, `getSchemas`

2. **Kysely Helpers** (`prisma-effect-kysely/kysely`):
   - Runtime helpers for Kysely integration
   - Exports: `getSchemas`, `columnType`, `generated`
   - Type utilities: `Selectable`, `Insertable`, `Updateable`, `Id`

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
Optional: `Schema.optional(baseType)`

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
|   |   +-- generator.ts      # Kysely table interface generation
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

## For Future Claude Code Instances

- [ ] Run `npm test` before making changes to verify baseline
- [ ] Consumers use type utilities: `Selectable<typeof User>`, NOT `UserSelect`
- [ ] Each model with `@id` gets a branded ID schema: `const UserIdSchema = ...`
- [ ] Generated output uses spread pattern: `{ ...getSchemas(_Model), Id: ModelIdSchema }`
- [ ] NO type exports in generated code - only schemas
- [ ] Join tables do NOT get branded IDs (they use composite keys)
- [ ] DB interface uses Kysely table interfaces: `User: UserTable`
