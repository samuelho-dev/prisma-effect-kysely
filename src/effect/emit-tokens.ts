/**
 * Centralized emitted-string tokens for generated code.
 *
 * Single swap point for the Effect v3 → v4 migration. Every generator that
 * builds Schema source as strings imports from here so the v4 branch can
 * change values in one place.
 *
 * v3 → v4 deltas anticipated:
 * - EMIT_UUID: `Schema.UUID` → `Schema.String.check(Schema.isUUID())`
 * - EMIT_DATETIME: `Schema.DateFromSelf` → `Schema.Date`
 * - EMIT_BIGINT_FROM_SELF: `Schema.BigIntFromSelf` → `Schema.BigInt`
 * - emitFromKey: per-field `.pipe(Schema.fromKey("k"))` → struct-level
 *   `Schema.encodeKeys({ ts: "k" })` (structural change, not just a token swap)
 * - emitAnnotate: `.annotations({...})` → `.annotate({...})`
 * - emitReveal: `Schema.asSchema` → `Schema.revealCodec`
 */

export const EMIT_STRING = 'Schema.String';
export const EMIT_NUMBER = 'Schema.Number';
export const EMIT_BIGINT = 'Schema.BigInt';
export const EMIT_BOOLEAN = 'Schema.Boolean';
export const EMIT_BYTES = 'Schema.Uint8Array';
export const EMIT_NEVER = 'Schema.Never';
export const EMIT_UNKNOWN = 'Schema.Unknown';

/** UUID schema. v4 swap: `Schema.String.check(Schema.isUUID())`. */
export const EMIT_UUID = 'Schema.UUID';

/**
 * DateTime schema. Uses `DateFromSelf` so Type = Encoded = Date for Kysely.
 * v4 swap: `Schema.Date`.
 */
export const EMIT_DATETIME = 'Schema.DateFromSelf';

/** BigInt branded ID base type. v4 swap: `Schema.BigInt`. */
export const EMIT_BIGINT_FROM_SELF = 'Schema.BigIntFromSelf';

/** Int branded ID base type. */
export const EMIT_INT = 'Schema.Int';

/** Effect import statement. */
export const EMIT_EFFECT_IMPORT = 'import { Schema } from "effect";';

/** Wrap a base type in `Schema.Array(...)`. */
export const emitArray = (inner: string) => `Schema.Array(${inner})`;

/** Wrap a base type in `Schema.NullOr(...)`. */
export const emitNullOr = (inner: string) => `Schema.NullOr(${inner})`;

/** Emit `Schema.Enums(<rawEnumName>)`. */
export const emitEnums = (rawEnumName: string) => `Schema.Enums(${rawEnumName})`;

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
 * Emit a `@map` field-rename wrapper.
 *
 * v3: `Schema.propertySignature(<inner>).pipe(Schema.fromKey("<dbKey>"))`
 * v4: caller must collect renames and emit a single struct-level
 *     `Schema.encodeKeys({...})` instead. See `emitEncodeKeys`.
 */
export const emitFromKey = (inner: string, dbKey: string) =>
  `Schema.propertySignature(${inner}).pipe(Schema.fromKey("${dbKey}"))`;

/**
 * v4-only: Emit a struct-level `Schema.encodeKeys` rename map.
 * Unused on v3; declared here so the call sites exist for the v4 branch.
 */
export const emitEncodeKeys = (renames: Record<string, string>) => {
  const entries = Object.entries(renames)
    .map(([ts, db]) => `${ts}: "${db}"`)
    .join(', ');
  return `Schema.encodeKeys({ ${entries} })`;
};
