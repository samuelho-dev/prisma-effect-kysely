---
"prisma-effect-kysely": major
---

**BREAKING**: Kysely-native type utility pattern

This release changes how consumers access types from generated schemas, aligning with Kysely's native patterns.

## Breaking Changes

### Removed type exports
Generated code no longer exports individual type aliases:
```typescript
// REMOVED - these no longer exist
export type UserSelect = ...
export type UserInsert = ...
export type UserUpdate = ...
```

### New pattern: Type utilities
Import type utilities from the library and use with generated schemas:
```typescript
import { Selectable, Insertable, Updateable, Id } from 'prisma-effect-kysely';
import { User } from './generated';

type UserRow = Selectable<typeof User>;
type NewUser = Insertable<typeof User>;
type UserPatch = Updateable<typeof User>;
type UserId = Id<typeof User>;
```

## New Features

### Branded ID types
Each model with an `@id` field now includes a branded ID schema:
```typescript
export const User = {
  ...getSchemas(_User),
  Id: UserIdSchema,  // Branded type: Schema.UUID.pipe(Schema.brand("UserId"))
} as const;
```

### Type utilities exported from library
- `Selectable<T>` - Row type for SELECT queries
- `Insertable<T>` - Type for INSERT operations
- `Updateable<T>` - Type for UPDATE operations
- `Id<T>` - Branded ID type

## Migration

Replace direct type imports with type utilities:
```typescript
// Before
import { UserSelect, UserInsert } from './generated';

// After
import { Selectable, Insertable } from 'prisma-effect-kysely';
import { User } from './generated';
type UserSelect = Selectable<typeof User>;
type UserInsert = Insertable<typeof User>;
```

## Documentation

- Fixed README.md: DateTime correctly maps to `Schema.DateFromSelf` (not `Schema.Date`)
- Updated CLAUDE.md with new architecture documentation
