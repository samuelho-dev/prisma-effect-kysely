---
'prisma-effect-kysely': patch
---

Fix critical Effect Schema type errors and migrate to Biome linting

- Fix Schema.make context preservation in kysely helpers
- Replace Jest with Vitest for ESM compatibility
- Migrate from ESLint to Biome for modern linting
- Update all test files to use Vitest APIs
- Fix enum generation redeclaration conflicts
- Refactor complex functions to reduce cognitive complexity
- Remove all non-null assertions with proper null checks
- Update Node.js minimum version to 20.0.0
