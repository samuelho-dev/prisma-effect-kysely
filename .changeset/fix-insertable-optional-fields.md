---
"prisma-effect-kysely": minor
---

fix(Insertable): Make @default and nullable fields optional instead of excluded

**Breaking Change in Behavior (but type-compatible):**

- Fields with `@default` in Prisma schema are now **optional on insert** instead of completely excluded
- Fields with nullable types (`Schema.NullOr()`) are now **optional on insert** matching Kysely's behavior

**Changes:**

1. `Generated<T>` now uses `VariantMarker<T | undefined, T>` instead of `VariantMarker<never, T>`
   - This makes `@default` fields optional rather than impossible to provide
   - You can still omit them (database uses default) or provide a value

2. `IsOptionalInsert<T>` now checks for both `null` and `undefined` in the insert type
   - Matches Kysely's `IfNullable` behavior: `undefined extends T ? K : null extends T ? K : never`
   - Nullable fields (`string | null`) are now optional on insert since omitting = NULL in database

3. `CustomInsertable<T>` type updated to properly split required vs optional fields
   - Required: fields where insert type doesn't include null or undefined
   - Optional: fields where insert type includes null or undefined (with `?` modifier)

**Example:**

```typescript
// Before: status was excluded from Insertable<Product>
// After: status is optional in Insertable<Product>
const product: Insertable<Product> = {
  name: "My Product",
  price: 100,
  // status?: PRODUCT_STATUS - optional, defaults to DRAFT
  // thumbnail?: string | null - optional, defaults to NULL
}
```
