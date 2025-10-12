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

Native TypeScript enums with Effect Schema wrappers in namespaces:

```typescript
export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
  GUEST = "GUEST"
}

export namespace UserRole {
  export const Schema = Schema.Enums(UserRole);
  export type Type = Schema.Schema.Type<typeof Schema>;
}

// Usage:
// - Access enum values: UserRole.ADMIN, UserRole.USER
// - Access Effect Schema: UserRole.Schema
// - Access TypeScript type: UserRole.Type
```

### types.ts

Effect Schema structs from Prisma models with Kysely integration:

```typescript
// Base schema with underscore prefix
export const _User = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never), // Read-only ID
  email: Schema.String,
  name: Schema.Union(Schema.String, Schema.Undefined),     // Optional field
  role: UserRole.Schema,
  createdAt: generated(Schema.Date),                       // Generated field
});

// Operational schemas and types in namespace
export namespace User {
  const schemas = getSchemas(_User);
  export const Selectable = schemas.Selectable;  // For SELECT queries
  export const Insertable = schemas.Insertable;  // For INSERT (generated fields optional)
  export const Updateable = schemas.Updateable;  // For UPDATE (all fields optional)

  export type Select = Schema.Schema.Type<typeof User.Selectable>;
  export type Insert = Schema.Schema.Type<typeof User.Insertable>;
  export type Update = Schema.Schema.Type<typeof User.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof User.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof User.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof User.Updateable>;
}

// Kysely DB interface for type-safe queries
export interface DB {
  User: Schema.Schema.Encoded<typeof _User>;
  // ... other models
}
```

**Name Preservation**: All names from your Prisma schema are preserved exactly:
- Model `User` → `User` namespace with `User.Select`, `User.Insert`, `User.Update`
- Model `session_preference` → `session_preference` namespace
- Enum `ACTIVE_STATUS` → `ACTIVE_STATUS` enum and namespace

This creates a complete bridge from Prisma → Effect → Kysely → TypeScript with stable, predictable names.

### index.ts

Re-exports all generated types for easy importing

## Namespace Pattern

The generator uses TypeScript namespaces to organize generated code while preserving your Prisma schema names exactly.

### Benefits

- **Zero Name Transformations**: Your Prisma names flow unchanged through Effect, Kysely, and TypeScript
- **No Naming Conflicts**: Namespaces eliminate collisions without requiring name transformations
- **Grouped Exports**: Related schemas, types, and values are logically grouped
- **Clean API**: Access everything through a single identifier (e.g., `User.Select`, `User.Insertable`)

### Structure

**For Enums:**
```typescript
export enum ACTIVE_STATUS { ACTIVE, INACTIVE }  // Native TypeScript enum
export namespace ACTIVE_STATUS {                // Namespace merging
  export const Schema = Schema.Enums(ACTIVE_STATUS);  // Effect Schema
  export type Type = Schema.Schema.Type<typeof Schema>; // TypeScript type
}
```

**For Models:**
```typescript
export const _User = Schema.Struct({ ... });  // Base schema (underscore prefix)
export namespace User {                        // Namespace for operational schemas
  const schemas = getSchemas(_User);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
  export type Select = ...;
  export type Insert = ...;
  // ... more types
}
```

**For Join Tables:**
```typescript
export const _CategoryToPost = Schema.Struct({ A, B });
export namespace CategoryToPost {
  // Same pattern as models
}
```

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
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Build
npm run build
```

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
