---
"prisma-effect-kysely": major
---

feat!: Minimal exports API - hide internal schemas and interfaces

BREAKING CHANGE: Internal schemas and interfaces are no longer exported.

## What changed

- `_User` base schemas are now internal (not exported)
- `UserTable` Kysely interfaces are now internal (not exported)
- `UserIdSchema` branded ID schemas are now internal (not exported)
- Type aliases (`UserSelect`, `UserInsert`, `UserUpdate`, `*Encoded`) are removed

Only operational schemas and the DB interface are exported:
- `export const User = getSchemas(_User, UserIdSchema)`
- `export interface DB { User: UserTable; ... }`

## Migration

```typescript
// Before (v3.x)
import { _User, UserTable, UserSelect, UserInsert } from './generated';

// After (v4.0)
import { User, DB } from './generated';
import { Selectable, Insertable, Updateable, Id } from 'prisma-effect-kysely';

// Access base schema via _base property
const baseSchema = User._base;

// Use type utilities instead of type aliases
type UserSelect = Selectable<typeof User>;
type UserInsert = Insertable<typeof User>;
type UserUpdate = Updateable<typeof User>;
type UserId = Id<typeof User>;
```

## Why this change

- **Reduced confusion**: Users only see what they need (`User`, `DB`)
- **Cleaner API**: Follows Kysely's native pattern
- **Internal details hidden**: `_User`, `UserTable`, `UserIdSchema` are implementation details
- **Type utilities work unchanged**: `Selectable<typeof User>` continues to work via `User._base`
