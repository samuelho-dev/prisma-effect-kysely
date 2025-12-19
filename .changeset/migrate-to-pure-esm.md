---
'prisma-effect-kysely': minor
---

Migrate to Pure ESM standards.

- Change package type to module and update exports.
- Switch to ESNext module and Bundler resolution in tsconfig.
- Update test suite for ESM compatibility using @jest/globals and import.meta.dirname.
- Standardize imports with node: prefix and explicit re-exports.
- Ensure generated code and build output follow ESM standards.
