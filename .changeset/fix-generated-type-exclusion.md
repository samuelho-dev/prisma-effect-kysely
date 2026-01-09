---
"prisma-effect-kysely": patch
---

Fix `generated()` fields not excluded from `Insertable<T>` type utility at compile-time

The `generated()` function correctly filtered fields from `Insertable` at runtime, but the `Insertable<T>` type utility did not exclude these fields at compile-time. This caused TypeScript to require generated fields (like `createdAt`, `updatedAt`) when inserting records, even though they would be ignored at runtime.

**Changes:**
- Added `GeneratedInsertPhantom` phantom type symbol for compile-time tracking
- Created `GeneratedSchema<SType, SEncoded, SR>` type that marks fields as generated
- Updated `ExtractInsertPhantom` type utility to detect generated fields
- Updated `HasNeverInsert` type utility to exclude generated fields from insertable types
- Updated `generated()` function to return `GeneratedSchema` type

**Before (bug):**
```typescript
type UserInsert = Insertable<typeof User>;
// TypeScript required: { id, createdAt, updatedAt, name, email }
// But runtime only accepted: { name, email }
```

**After (fixed):**
```typescript
type UserInsert = Insertable<typeof User>;
// TypeScript correctly requires: { name, email }
// Matches runtime behavior
```
