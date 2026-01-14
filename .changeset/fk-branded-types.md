---
"prisma-effect-kysely": minor
---

feat: Generate branded ID schemas for foreign key fields

Foreign key columns now use the referenced model's branded ID schema instead of plain `Schema.UUID`. This enables type-safe FK references throughout your application.

**Changes:**
- FK fields like `seller.user_id` now generate as `UserIdSchema` instead of `Schema.UUID`
- All branded ID schemas are generated at the top of the file to avoid declaration order issues
- Added `buildForeignKeyMap()` utility to detect FK relationships from DMMF

**Example:**
```typescript
// Before
export const _seller = Schema.Struct({
  user_id: Schema.UUID,  // Plain UUID
});

// After
export const _seller = Schema.Struct({
  user_id: UserIdSchema,  // Branded type from User model
});
```

This enables type-safe FK usage without manual type assertions.
