---
"prisma-effect-kysely": minor
---

feat: use branded ID types in implicit M:N join table schemas

Join table schemas now reference branded ID types (e.g., `ProductId`, `SellerId`) instead of raw `Schema.UUID`/`Schema.String`/`Schema.Number`. This means Kysely queries on implicit many-to-many join tables return properly branded types, eliminating the need for manual `Schema.decodeSync` workarounds at query sites.

Before:
```typescript
columnType(Schema.UUID, Schema.Never, Schema.Never)
```

After:
```typescript
columnType(ProductId, Schema.Never, Schema.Never)
```

The branded ID schemas are guaranteed to exist in the generated output because they are emitted during model schema generation, which runs before join table generation.
