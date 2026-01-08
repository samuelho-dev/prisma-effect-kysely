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

Exports:
- `export type UserId` - branded ID types (directly importable)
- `export const User = getSchemas(_User, UserIdSchema)` - operational schemas
- `export interface DB { User: UserTable; }` - Kysely DB interface

## Migration

```typescript
// Before (v3.x)
import { _User, UserTable, UserSelect, UserInsert } from './generated';

// After (v4.0)
import { User, UserId, DB } from './generated';
import { Selectable, Insertable, Updateable } from 'prisma-effect-kysely';

// Branded ID types are exported directly
function getUser(id: UserId): Promise<...> { ... }

// Access base schema via _base property
const baseSchema = User._base;

// Use type utilities for Selectable/Insertable/Updateable
type UserSelect = Selectable<typeof User>;
type UserInsert = Insertable<typeof User>;
type UserUpdate = Updateable<typeof User>;
```

## Why this change

- **Reduced confusion**: Users only see what they need (`User`, `DB`)
- **Cleaner API**: Follows Kysely's native pattern
- **Internal details hidden**: `_User`, `UserTable`, `UserIdSchema` are implementation details
- **Type utilities work unchanged**: `Selectable<typeof User>` continues to work via `User._base`
