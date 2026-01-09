---
"prisma-effect-kysely": patch
---

fix: Improved Schema type compatibility

- Updated `getSchemas()` to use `Schema.Schema.Any` constraint for better type inference
- Removed intersection-based phantom types that could cause type compatibility issues
- Simplified `columnType()` and `generated()` return types to plain `Schema.Schema`

Note: Like all Effect-based packages, consumers must use `skipLibCheck: true` in their tsconfig. This is a requirement of the Effect ecosystem, not specific to this package.
