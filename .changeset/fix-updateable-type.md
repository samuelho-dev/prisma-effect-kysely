---
"prisma-effect-kysely": patch
---

fix: Use __update__ property for type extraction instead of VariantMarker

The Updateable<T> and Insertable<T> types now use the __update__ and __insert__
phantom properties for type extraction instead of the VariantMarker interface
with unique symbols.

This fixes an issue where the type extraction would fail during cross-compilation
when TypeScript compiles source files across module boundaries. The unique symbol
approach caused type matching failures because each compilation context could
create different symbol references.

The new approach using __update__ and __insert__ properties is more reliable
as these are standard object properties that TypeScript matches structurally.
