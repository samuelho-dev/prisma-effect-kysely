---
"prisma-effect-kysely": patch
---

Fix: Exclude Never-typed fields from Insertable/Updateable at compile-time

The `columnType` function now returns a `ColumnTypeSchema` type with phantom type properties that encode the insert/update type constraints. The `Insertable<T>` and `Updateable<T>` type utilities use these phantom types to correctly exclude `never`-typed fields at the TypeScript type level.

**Changes:**
- `columnType()` now returns `ColumnTypeSchema<S, E, R, I, U>` with phantom types for insert/update
- `getSchemas()` now stores the base schema in `_base` property for type-level field extraction
- `Insertable<T>` and `Updateable<T>` type utilities compute correct types by:
  - Extracting struct fields from `_base` schema
  - Filtering out fields with `never` phantom types
  - Computing the correct insert/update type per field

**Example:**
```typescript
const _User = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
});
const User = getSchemas(_User);

// At compile-time:
type UserInsert = Insertable<typeof User>;
// = { name: string }  // 'id' correctly excluded

type UserUpdate = Updateable<typeof User>;
// = { name?: string }  // 'id' correctly excluded
```
