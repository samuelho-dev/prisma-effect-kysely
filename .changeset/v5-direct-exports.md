---
"prisma-effect-kysely": major
---

## v5.0 - Direct Exports API

This is a **breaking change** that simplifies the generated code structure and improves the developer experience.

### Breaking Changes

**Generated Code Structure**:
- Schemas are now exported directly: `export const User = Schema.Struct({...})`
- Branded ID types are exported directly: `export const UserId = Schema.UUID.pipe(Schema.brand("UserId"))`
- DB interface uses `Selectable<Model>` pattern: `User: Selectable<User>`
- No more `_Model` underscore prefix or `getSchemas()` wrapper in generated code

**Consumer API Changes**:
- Import branded IDs directly: `import { UserId } from "./generated"`
- Use type utilities for other types: `Selectable<typeof User>`, `Insertable<typeof User>`, `Updateable<typeof User>`
- The `Id<typeof User>` utility is no longer needed - import `UserId` directly

### Migration Guide

Before (v4.x):
```typescript
import { Selectable, Insertable, Updateable, Id } from "prisma-effect-kysely";
import { User, DB } from "./generated";

type UserId = Id<typeof User>;
type UserSelect = Selectable<typeof User>;
```

After (v5.0):
```typescript
import { Selectable, Insertable, Updateable } from "prisma-effect-kysely";
import { User, UserId, DB } from "./generated";

// UserId is now imported directly
type UserSelect = Selectable<typeof User>;
```

### Improvements

- Simpler generated code structure
- Branded ID types are first-class exports
- Better alignment with Effect Schema patterns
- DB interface uses `Selectable<Model>` for clearer intent
- Join tables use semantic snake_case field names with `Schema.fromKey` mapping
