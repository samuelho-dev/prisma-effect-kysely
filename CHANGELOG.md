# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2025-10-09

### Fixed

- **Effect Schema Compatibility** - Fixed `generated()` and `columnType()` helpers to preserve type information instead of using `S.Never.ast`
  - Updated helpers to use `.annotations()` method following Effect Schema best practices
  - Added R (Requirements) type parameter to preserve context/requirements through schema transformations
  - Fixes compatibility with Effect 3.18.4 where `never` type was propagating through all generated types
  - No breaking changes - all existing functionality preserved

### Technical Details

The previous implementation used `S.make(AST.annotations(S.Never.ast, {...}))` which created schemas with `never` as the Requirements parameter. This caused TypeScript errors with Effect 3.18.4. The fix uses `schema.annotations({...})` instead, which preserves the original schema's type signature (`Schema<SType, SEncoded, R>`) while attaching custom metadata. This follows the official Effect Schema documentation pattern for adding annotations without changing the schema's type.

**Changed files:**
- `src/kysely/helpers.ts`: Updated `columnType()` and `generated()` functions
- `src/__tests__/kysely-helpers.test.ts`: Updated test assertions to match new behavior

[1.3.1]: https://github.com/samuelho-dev/prisma-effect-kysely/compare/v1.3.0...v1.3.1

## [1.3.0] - 2025-10-09

### Fixed

- **TypeScript TS2742 Error** - Added `@prisma/dmmf@^6.17.0` as a direct dependency to resolve "The inferred type of X cannot be named without a reference to .pnpm/@prisma+dmmf" error
  - This was a pnpm-specific issue where transitive dependencies weren't accessible for TypeScript declaration generation
  - No code changes required - purely a dependency resolution fix
  - Makes the package portable across npm, pnpm, and yarn

### Technical Details

TypeScript couldn't generate portable type declarations because `@prisma/dmmf` was only available as a transitive dependency through `@prisma/generator-helper`. By adding it as a direct dependency, the DMMF types are now accessible to TypeScript's declaration generator, allowing proper `.d.ts` file generation without referencing internal pnpm paths.

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
