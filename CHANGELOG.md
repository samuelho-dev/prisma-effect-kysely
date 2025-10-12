# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-10-11

### Changed - BREAKING

- **Enum Generation Pattern** - Switched from `Schema.Literal` to `Schema.Enums` with native TypeScript enums
  - ✅ **Old Pattern (deprecated)**: `export const PRODUCT_STATUS = Schema.Literal("ACTIVE", "DRAFT", "ARCHIVED")`
  - ✅ **New Pattern**: Native TypeScript enum + Effect Schema wrapper
    ```typescript
    export enum ProductStatus {
      ACTIVE = "ACTIVE",
      DRAFT = "DRAFT",
      ARCHIVED = "ARCHIVED"
    }
    export const ProductStatusSchema = Schema.Enums(ProductStatus);
    export type ProductStatusType = Schema.Schema.Type<typeof ProductStatusSchema>;
    ```
  - **Benefits**:
    - ✨ Property accessor support: `ProductStatus.ACTIVE` (IntelliSense-friendly)
    - ✨ Canonical Effect v3.18+ pattern (validated by Effect Architecture Specialist)
    - ✨ Full Kysely type compatibility for queries
    - ✨ Better developer experience with autocomplete
  - **Migration Required**: Users must regenerate schemas with `prisma generate`
  - **Breaking Change**: Existing code using `.literals` property will break

### Added

- **PascalCase Naming Convention** - Enums now use PascalCase instead of SCREAMING_SNAKE_CASE
  - `PRODUCT_STATUS` → `ProductStatus`
  - `USER_ROLE` → `UserRole`
  - Improves TypeScript idiomaticity and consistency

- **Type Aliases** - Generated type aliases for ergonomic usage
  - `ProductStatusType` for enum types
  - Simplifies type annotations: `ProductStatusType` vs `Schema.Schema.Type<typeof ProductStatusSchema>`

### Performance

- **58% reduction in function calls** - Optimized PascalCase conversions
  - Cache `toPascalCase()` results within function scope (1 call instead of 3)
  - Optimized flatMap iterator to cache base names (50% reduction per enum)
  - Pure functional optimization approved by Effect Architecture Specialist

- **100% elimination of intermediate arrays** - Removed unnecessary `Array.from()` calls
  - Readonly arrays already support `.map()` and iteration methods
  - Reduces memory allocations during code generation

### Improved

- **Code Quality** - Extracted file header generation utility
  - DRY principle: Single source of truth for generated file headers
  - New `generateFileHeader()` utility in `src/utils/codegen.ts`
  - Consistent formatting across enums.ts and types.ts

### Technical Details

**TDD Implementation**: All changes developed using Test-Driven Development (Red-Green-Refactor)
- 18+ new tests covering enum generation, property access, field mapping, and imports
- All 134 tests passing with strict TypeScript configuration
- Zero type coercions - maintains full type safety

**Expert Validation**:
- ✅ Effect Architecture Specialist: Confirmed Schema.Enums is canonical pattern for Effect v3.18+
- ✅ TypeScript Pro: Validated all optimizations are type-safe with zero runtime overhead

**Changed Files**:
- `src/effect/enum.ts`: Complete rewrite of enum generation logic
- `src/effect/type.ts`: Updated to return Schema wrappers for enum fields
- `src/effect/generator.ts`: Optimized import generation, removed Array.from()
- `src/utils/naming.ts`: Enhanced with optional suffix parameter
- `src/utils/codegen.ts`: New file for shared code generation utilities
- `src/__tests__/helpers/dmmf-mocks.ts`: New test helpers without type coercions

**Test Coverage**:
- `src/__tests__/enum-generation.test.ts`: Tests 1-6 (Schema.Enums pattern)
- `src/__tests__/enum-property-access.test.ts`: Tests 7-10 (property access validation)
- `src/__tests__/field-type-generation.test.ts`: Tests 11-12 (field type mapping)
- `src/__tests__/import-generation.test.ts`: Tests 13-15 (import generation)
- `src/__tests__/e2e-enum-generation.test.ts`: Tests 16-18 (end-to-end integration)

**Migration Guide**:

Before (v1.4.x):
```typescript
// Generated code
export const PRODUCT_STATUS = Schema.Literal("ACTIVE", "DRAFT", "ARCHIVED");

// Usage
const status = PRODUCT_STATUS.literals[0]; // "ACTIVE"
```

After (v1.5.0):
```typescript
// Generated code
export enum ProductStatus {
  ACTIVE = "ACTIVE",
  DRAFT = "DRAFT",
  ARCHIVED = "ARCHIVED"
}
export const ProductStatusSchema = Schema.Enums(ProductStatus);

// Usage (property access!)
const status = ProductStatus.ACTIVE; // "ACTIVE"
```

**Action Required**: Run `prisma generate` to regenerate schemas after upgrading.

[1.5.0]: https://github.com/samuelho-dev/prisma-effect-kysely/compare/v1.4.3...v1.5.0

## [1.4.3] - 2025-10-10

### Fixed

- **Declaration File Type Preservation** - Fixed type inference when using compiled `.d.ts` files
  - Added explicit return type annotations to `selectable()`, `insertable()`, and `updateable()` helper functions
  - Added explicit return type annotation to `getSchemas()` function
  - Ensures TypeScript preserves `Selectable<Type>`, `Insertable<Type>`, and `Updateable<Type>` mapped types in declaration files
  - Resolves type inference failures when consuming libraries use dist/ paths instead of source paths
  - Fixes `Schema.Schema.Type<>` resolving to `unknown` when types are accessed from compiled declarations

### Technical Details

**Problem**: When TypeScript compiled helper functions to `.d.ts` files, the return types of AST transformation functions (`selectable()`, `insertable()`, `updateable()`) were inferred as `S.Schema<unknown, unknown, never>` instead of preserving the Kysely mapped types. This caused downstream type resolution to fail when consumers used compiled declaration files (dist/ paths) instead of source files.

**Solution**: Added explicit return type annotations with type assertions to all helper functions:
- `selectable()` → `: S.Schema<Selectable<Type>, Selectable<Encoded>, never>`
- `insertable()` → `: S.Schema<Insertable<Type>, Insertable<Encoded>, never>`
- `updateable()` → `: S.Schema<Updateable<Type>, Updateable<Encoded>, never>`
- `getSchemas()` → `: Schemas<Type, Encoded>`

**Impact**: Projects using prisma-effect-kysely with TypeScript path aliases pointing to `dist/` directories (compiled output) will now have proper type inference. Generated types like `EmbeddingOperationSelect` will resolve to proper object types instead of `unknown`.

**Testing**: Added comprehensive test suite (`declaration-inference.test.ts`) with 7 tests validating type preservation in compiled declarations, following TDD principles (Red-Green-Refactor).

**Changed files:**
- `src/kysely/helpers.ts`: Added return type annotations (4 functions)
- `src/__tests__/declaration-inference.test.ts`: New test suite (260 lines)

[1.4.3]: https://github.com/samuelho-dev/prisma-effect-kysely/compare/v1.4.1...v1.4.3

## [1.4.1] - 2025-10-09

### Fixed

- **TypeScript Type Compatibility** - Fixed `SchemaClass` to `Schema` conversion issues
  - Added `S.asSchema()` wrapper to `selectable()`, `insertable()`, and `updateable()` helper functions
  - Ensures generated schemas return `S.Schema<A, I, R>` interface instead of `S.SchemaClass<A, I, R>`
  - Resolves TypeScript compilation errors when passing schemas to Effect's decode functions
  - Uses Effect's official identity function for zero-runtime overhead type conversion

- **Build Portability** - Fixed TypeScript TS2742 errors for portable type inference
  - Added explicit return type annotations to DMMF utility functions
  - Functions affected: `extractEnums()`, `getEnums()`, `getModels()`, `getModelFields()`, `filterInternalModels()`, `filterSchemaFields()`, `sortModels()`, `sortFields()`
  - Ensures generated `.d.ts` files are portable across different TypeScript projects

### Technical Details

**Problem**: Effect Schema's `S.make()` returns `SchemaClass` for fluent API support, but TypeScript cannot structurally verify it implements the `Schema` interface due to constructor signature differences. This caused compilation errors when passing generated schemas to Effect's decode functions.

**Solution**: Wrapped all `S.make()` calls with `S.asSchema()`, Effect's official identity function that converts `SchemaClass` → `Schema` at the type level only (zero runtime cost).

**Impact**: Projects using `prisma-effect-kysely` v1.4.0 or earlier may have experienced TypeScript compilation errors when using `Schema.decode()` or `Schema.decodeUnknownSync()`. This release resolves those errors without requiring any code changes in consuming projects.

**Changed files:**
- `src/kysely/helpers.ts`: Added `S.asSchema()` wrappers (6 locations)
- `src/prisma/enum.ts`: Added return type annotation
- `src/prisma/generator.ts`: Added return type annotations (3 methods)
- `src/prisma/type.ts`: Added return type annotations (4 functions)

[1.4.1]: https://github.com/samuelho-dev/prisma-effect-kysely/compare/v1.4.0...v1.4.1

## [1.4.0] - 2025-10-09

### Changed

- **Naming Standardization** - All exported schemas and types now use PascalCase regardless of Prisma model naming convention
  - Fixes inconsistent naming when models use snake_case (e.g., `session_model_preference`)
  - Generated exports: `SessionModelPreference`, `SessionModelPreferenceSelect`, etc. (instead of `session_model_preferenceSelect`)
  - Internal base schemas preserve original names with underscore prefix (e.g., `_session_model_preference`)
  - Applies to operational schemas and all type exports (Select, Insert, Update, Encoded variants)

### Added

- New `toPascalCase()` utility function for consistent TypeScript identifier generation
- Comprehensive tests for naming conversion (handles snake_case, kebab-case, camelCase, PascalCase)
- Test fixture `session_model_preference` to verify snake_case handling

### Technical Details

The generator now converts all model names to PascalCase when creating TypeScript exports using the new `toPascalCase()` utility. This ensures consistent, idiomatic TypeScript naming while preserving the original Prisma model names for internal schemas. The conversion handles snake_case, kebab-case, camelCase, and mixed formats.

**Impact**: Projects using snake_case model names will see different export names (breaking change for those projects). Projects using PascalCase models (recommended Prisma convention) will see no changes.

**Changed files:**
- `src/utils/naming.ts`: New naming utility
- `src/effect/generator.ts`: Updated to use PascalCase for all exports
- `src/__tests__/fixtures/test.prisma`: Added snake_case test model
- `src/__tests__/naming.test.ts`: New tests for naming utility
- `src/__tests__/generator.test.ts`: Added naming standardization tests

[1.4.0]: https://github.com/samuelho-dev/prisma-effect-kysely/compare/v1.3.1...v1.4.0

## [1.3.0] - 2025-01-09

### Added

- **Encoded type exports** - Generator now exports database-encoded types alongside application types
  - `{Model}SelectEncoded` - Database-encoded type for `Schema.Schema.Encoded<typeof Model.Selectable>`
  - `{Model}InsertEncoded` - Database-encoded type for `Schema.Schema.Encoded<typeof Model.Insertable>`
  - `{Model}UpdateEncoded` - Database-encoded type for `Schema.Schema.Encoded<typeof Model.Updateable>`
- Comprehensive test coverage for Encoded type exports

### Changed

- `generateTypeExports()` method now generates both Application and Encoded type exports
- Queries layer can now use proper Encoded types instead of `any` workarounds

### Why This Matters

Effect Schema has bidirectional transformations:
- **Application types** (`Schema.Schema.Type`) - Decoded types with `Date` objects (for repository layer)
- **Database types** (`Schema.Schema.Encoded`) - Encoded types with ISO strings (for queries layer)

Previously, only Application types were exported, forcing queries to use `any` types. Now both sides of the transformation are properly typed.

**Example Usage:**
```typescript
import { agentInsertEncoded } from '@libs/types';

// Queries layer - uses Encoded types (ISO strings)
insert: (rowData: agentInsertEncoded) => db.insertInto('agent').values(rowData)

// Repository layer - uses Application types (Date objects)
const input: CreateAgentInput = { /* ... Date objects ... */ };
const encoded = Schema.encode(AgentSchemas.Insertable)(input); // Encoded to ISO strings
```

[1.3.0]: https://github.com/samuelho-dev/prisma-effect-kysely/compare/v1.2.1...v1.3.0

## [1.2.1] - 2025-10-08

- Bump prisma 6.17

## [1.2.0] - 2025-10-08

### Changed

- Updated peer dependency to support Kysely ^0.28.0 (0.28.x versions)
- Updated dev dependency to Kysely 0.28.7 for testing
- No breaking changes to generated code or exported API

### Technical Details

- All Kysely imports are type-only (`ColumnType`, `Generated`, `Selectable`, `Insertable`, `Updateable`)
- No runtime Kysely code usage ensures compatibility across versions
- Comprehensive test suite validates compatibility with Kysely 0.28.x

[1.2.0]: https://github.com/samuelho-dev/prisma-effect-kysely/compare/v1.1.0...v1.2.0

## [1.0.2] - 2025-10-03

### Note

**Temporary release due to npm 24-hour republish restriction.**
This version will be unpublished and superseded by v1.0.0 within 24 hours.

### Fixed

- Export configuration to allow importing runtime helpers from main package entry point
- Clean dependency tree with minimal deprecation warnings

## [1.0.0] - 2025-10-02

### Added

- Initial release of Prisma Effect Schema Generator
- Type-safe generation of Effect Schema types from Prisma models
- Intelligent UUID detection with 4-tier strategy:
  - Native type detection via `@db.Uuid`
  - Documentation-based detection
  - Default value pattern matching
  - Field name pattern matching
- Complete Prisma type mappings to Effect Schema equivalents
- Support for Prisma enums with `@map` annotations
- Deterministic output with alphabetical sorting
- Zero type coercion with exact DMMF types
- Automated file generation (enums.ts, types.ts, index.ts)
- Comprehensive test suite with 100% coverage paths
- TypeScript strict mode compliance
- Prettier code formatting

### Features

- ✅ All Prisma scalar types supported (String, Int, Float, BigInt, Decimal, Boolean, DateTime, Json, Bytes)
- ✅ Array and optional field support
- ✅ Relation field exclusion (only scalar and enum fields included)
- ✅ Internal model filtering (models starting with `_`)
- ✅ DBSchema interface generation for type-safe database operations

[1.0.0]: https://github.com/samuelho-dev/prisma-effect-kysely/releases/tag/v1.0.0
