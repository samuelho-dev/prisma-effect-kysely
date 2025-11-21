# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Prisma generator that creates Effect Schema types from Prisma schema definitions with exact type safety and intelligent UUID detection.

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

3. **Generator Classes** (src/generator/generators/):
   - `EnumGenerator`: Creates enums.ts with Effect Literal schemas
   - `TypeGenerator`: Creates types.ts with Effect Struct schemas and DB interface
   - `IndexGenerator`: Creates index.ts re-export file

4. **Mapper Classes** (src/generator/mappers/):
   - `TypeMapper`: Maps Prisma types to Effect Schema types
   - `uuid-detector.ts`: Multi-strategy UUID field detection

5. **Utility Classes**:
   - `FileManager` (src/generator/utils/file-manager.ts): Handles file system operations
   - `templates.ts` (src/generator/utils/templates.ts): Uses Prettier to format generated code

### Output Structure
The generator creates three files in the configured output directory:

- **enums.ts**: Effect Schema Literal types for Prisma enums (supports @map)
- **types.ts**: Effect Schema Struct types for Prisma models with:
  - Base schemas prefixed with `_` (e.g., `_User`)
  - Operational schemas using `getSchemas()` (e.g., `User.Selectable`, `User.Insertable`, `User.Updateable`)
  - TypeScript type exports (e.g., `UserSelect`, `UserInsert`, `UserUpdate`)
  - Kysely `DB` interface with table mappings (supports `@@map` directive)
- **index.ts**: Re-exports all generated types

### Kysely Integration
The generator includes deep Kysely integration for type-safe database operations:

**Generated Schemas**: Each model generates:
- Base schema `_ModelName` with raw field definitions
- Operational schemas via `getSchemas(_ModelName)`:
  - `ModelName.Selectable`: Schema for SELECT queries
  - `ModelName.Insertable`: Schema for INSERT queries (fields with `@default` become optional)
  - `ModelName.Updateable`: Schema for UPDATE queries (all fields optional)

**Field Behavior**:
- Fields with `@default`: Wrapped in `generated()` - optional for insert, excluded from update
- ID fields with `@default`: Wrapped in `columnType(type, Schema.Never, Schema.Never)` - read-only
- Optional fields: Wrapped in `Schema.Union(type, Schema.Undefined)`

**Runtime Helpers** (imported from `prisma-effect-kysely`):
- `getSchemas(baseSchema)`: Creates Selectable/Insertable/Updateable schemas
- `columnType(select, insert, update)`: Custom column type definitions
- `generated(schema)`: Marks fields as database-generated
- `withEncoder`, `withDecoder`, `withCodec`: Effect-based query wrappers

**Database Errors** (from `prisma-effect-kysely/error`):
- `NotFoundError`: Query returned no results
- `QueryError`: Database query failed
- `QueryParseError`: Schema validation failed
- `DatabaseError`: Union of all error types

**DB Interface**: Generated Kysely database interface with table mappings:
```typescript
export interface DB {
  User: UserSelectEncoded;
  // Uses @@map directive if present, otherwise model name
}

// Where UserSelectEncoded is pre-resolved to avoid deep type instantiation:
export type UserSelectEncoded = Schema.Schema.Encoded<typeof User.Selectable>;
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
  ```
- **Benefits**:
  - Developer-friendly semantic names in TypeScript
  - Maintains Prisma A/B database compatibility
  - Type-safe bidirectional transformation
  - Follows snake_case convention for database identifiers

### Type Generation for Generated Fields (v1.9.0)

**Challenge**: TypeScript's `Schema.Schema.Type` inference works on static schema structure and cannot see runtime AST field filtering performed by v1.8.4's `insertable()` helper.

**Solution**: Generate explicit Insert types using TypeScript's `Omit` utility:
```typescript
// Generated code:
export type UserInsert = Omit<Schema.Schema.Type<typeof User.Insertable>, 'id' | 'createdAt' | 'updatedAt'>;
```

**Fields Automatically Omitted**:
- Fields with `@default` (both ID and non-ID): `@id @default(uuid())`, `@default(now())`
- Fields with `@updatedAt` directive

**Rationale**:
- TypeScript's type inference can't capture runtime AST transformations
- Explicit type generation is industry standard (Prisma Client, Drizzle ORM, tRPC all use this approach)
- Provides compile-time safety that runtime-only validation cannot
- Zero performance overhead (types erased at compile time)

**Pattern**: Standard code generation practice when runtime behavior differs from schema structure.

**Implementation**:
- `getOmittedInsertFields()` in `src/effect/generator.ts` identifies fields during code generation
- Uses DMMF properties: `field.hasDefaultValue` and `field.isUpdatedAt`
- Fields are alphabetically sorted in Omit union for deterministic output
- Models without generated fields use plain `Schema.Schema.Type` (no unnecessary Omit)

### UUID Detection Strategy
The generator uses a 3-tier detection strategy (in priority order):

1. **Native Type** (`field.nativeType[0] === 'Uuid'`): Most reliable, from `@db.Uuid`
2. **Documentation** (`field.documentation?.includes('@db.Uuid')`): From field comments
3. **Field Name Patterns** (fallback): Regex patterns for `id`, `*_id`, `*_uuid`, `uuid`

Implemented in `isUuidField()` (src/generator/mappers/uuid-detector.ts:10)

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

2. **Kysely Helpers** (`prisma-effect-kysely/kysely`):
   - Runtime helpers for Kysely integration
   - Exports: `getSchemas`, `columnType`, `generated`, `selectable`, `insertable`, `updateable`
   - Query wrappers: `withEncoder`, `withDecoder`, `withCodec`

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
| DateTime | `Schema.Date` | - |
| Json | `Schema.Unknown` | Safe unknown type |
| Bytes | `Schema.Uint8Array` | - |
| Enum | Enum Schema | Uses imported enum |

Arrays: `Schema.Array(baseType)`
Optional: `Schema.optional(baseType)`

### Deterministic Output

All models and fields are alphabetically sorted (src/generator/generators/type-generator.ts:64, 102) to ensure consistent generation across runs.

## Development Notes

- Generator must be built before running `prisma generate`
- The generator filters out internal models (those starting with `_`)
- All generated files include auto-generated headers with timestamps and edit warnings
- Field defaults are validated using exact DMMF type structure, not string parsing
- Relation fields are excluded from generated schemas - only scalar and enum fields are included
- Test fixtures are located in `src/__tests__/fixtures/test.prisma`
