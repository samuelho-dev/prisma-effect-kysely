---
"prisma-effect-kysely": minor
---

feat: Add optional Id parameter to getSchemas() for better type inference

The `getSchemas()` function now accepts an optional second parameter for the branded Id schema. This eliminates the need for object spread patterns in generated code, which caused TypeScript to lose the `_base` property needed for compile-time type utilities.

**Breaking Change in Generated Code:**

Before:
```typescript
export const User = {
  ...getSchemas(_User),
  Id: UserIdSchema,
} as const;
```

After:
```typescript
export const User = getSchemas(_User, UserIdSchema);
```

**New API:**

```typescript
// With Id (models with @id field)
const User = getSchemas(_User, UserIdSchema);
// Returns: SchemasWithId<Type, Encoded, BaseSchema, IdSchema>

// Without Id (models without @id, join tables)
const JoinTable = getSchemas(_JoinTable);
// Returns: Schemas<Type, Encoded, BaseSchema>
```

**Why this change:**

TypeScript's spread inference doesn't preserve the `_base` property from `getSchemas()` return type. This caused `Insertable<typeof User>` and `Updateable<typeof User>` to fail because `ExtractStructFields<T>` couldn't find the `_base` property needed for phantom type extraction.

**Migration:**

Re-run `prisma generate` to update generated code. No changes needed to consumer code using type utilities.
