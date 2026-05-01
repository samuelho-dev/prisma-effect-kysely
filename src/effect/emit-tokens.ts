/**
 * Centralized emitted-string tokens for generated code.
 *
 * Effect v4 forms.
 */

export const EMIT_STRING = 'Schema.String';
export const EMIT_NUMBER = 'Schema.Number';
export const EMIT_BIGINT = 'Schema.BigInt';
export const EMIT_BOOLEAN = 'Schema.Boolean';
export const EMIT_BYTES = 'Schema.Uint8Array';
export const EMIT_NEVER = 'Schema.Never';
export const EMIT_UNKNOWN = 'Schema.Unknown';

/** UUID schema (v4: filter on String). */
export const EMIT_UUID = 'Schema.String.check(Schema.isUUID())';

/** DateTime schema. v4 `Schema.Date` (Type = Encoded = Date for Kysely). */
export const EMIT_DATETIME = 'Schema.Date';

/** BigInt branded ID base type. v4: `Schema.BigInt`. */
export const EMIT_BIGINT_FROM_SELF = 'Schema.BigInt';

/** Int branded ID base type — v4 has no `Schema.Int`; use Number with isInt check. */
export const EMIT_INT = 'Schema.Number.check(Schema.isInt())';

/** Effect import statement. */
export const EMIT_EFFECT_IMPORT = 'import { Schema } from "effect";';

/** Wrap a base type in `Schema.Array(...)`. */
export const emitArray = (inner: string) => `Schema.Array(${inner})`;

/** Wrap a base type in `Schema.NullOr(...)`. */
export const emitNullOr = (inner: string) => `Schema.NullOr(${inner})`;

/**
 * Emit `Schema.Literals([...])` for an enum's DB values.
 * v4 removed `Schema.Enums`; the closest behavior-preserving replacement is
 * `Schema.Literals` over the same union of string literal values.
 */
export const emitLiterals = (values: ReadonlyArray<string>) => {
  const items = values.map((v) => `"${v}"`).join(', ');
  return `Schema.Literals([${items}])`;
};

/** Emit `<base>.pipe(Schema.brand("<id>"))`. */
export const emitBrand = (base: string, brand: string) => `${base}.pipe(Schema.brand("${brand}"))`;

/** Emit `columnType(<select>, <insert>, <update>)`. */
export const emitColumnType = (selectT: string, insertT: string, updateT: string) =>
  `columnType(${selectT}, ${insertT}, ${updateT})`;

/** Emit `generated(<inner>)`. */
export const emitGenerated = (inner: string) => `generated(${inner})`;

/** Emit `Schema.Schema.Type<typeof <name>>`. */
export const emitSchemaType = (name: string) => `Schema.Schema.Type<typeof ${name}>`;

/**
 * Emit a struct-level `Schema.encodeKeys` rename map.
 *
 * v4 replaces v3's per-field `Schema.propertySignature(...).pipe(Schema.fromKey(...))`
 * with one struct-level `.pipe(Schema.encodeKeys({ ts: "db", ... }))` after the
 * `Schema.Struct({...})` literal.
 */
export const emitEncodeKeys = (renames: Record<string, string>) => {
  const entries = Object.entries(renames)
    .map(([ts, db]) => `${ts}: "${db}"`)
    .join(', ');
  return `Schema.encodeKeys({ ${entries} })`;
};
