import { Schema } from 'effect';
import * as AST from 'effect/SchemaAST';
import type {
  Insertable as KyselyInsertable,
  Selectable as KyselySelectable,
  Updateable as KyselyUpdateable,
  ColumnType as KyselyColumnType,
  Generated as KyselyGenerated,
} from 'kysely';

/**
 * Runtime helpers for Kysely schema integration
 * These are imported by generated code
 *
 * ## Type Extraction Patterns
 *
 * For Effect Schemas (recommended - full type safety):
 * ```typescript
 * import { Selectable, Insertable, Updateable } from 'prisma-effect-kysely';
 * import { User } from './generated/types';
 *
 * type UserSelect = Selectable<User>;
 * type UserInsert = Insertable<User>;
 * type UserUpdate = Updateable<User>;
 * ```
 *
 * Note: This package exports branded versions of ColumnType and Generated that
 * are compatible with Effect Schema's type inference. These extend the base
 * select type (S) while carrying phantom insert/update type information.
 */

// Re-export Kysely's native type utilities with aliases for advanced use cases
export type {
  KyselySelectable,
  KyselyInsertable,
  KyselyUpdateable,
  KyselyColumnType,
  KyselyGenerated,
};

/**
 * Annotation keys used to mark ColumnType- and Generated-wrapped fields.
 *
 * Annotations live in a `Schema.Annotations.Annotations` interface with
 * string keys (`[x: string]: unknown`); only string keys round-trip through
 * `Schema.annotate`, so these are plain strings rather than symbols.
 */
export const ColumnTypeId = '~prisma-effect-kysely/ColumnType' as const;
export type ColumnTypeId = typeof ColumnTypeId;

export const GeneratedId = '~prisma-effect-kysely/Generated' as const;
export type GeneratedId = typeof GeneratedId;

/**
 * Symbol for VariantMarker - used in mapped type pattern that survives declaration emit.
 */
export const VariantTypeId: unique symbol = Symbol.for('prisma-effect-kysely/VariantType');
export type VariantTypeId = typeof VariantTypeId;

// ============================================================================
// Branded Type Definitions (Override Kysely's types)
// ============================================================================
// These branded types extend S while carrying phantom insert/update information.
// Unlike Kysely's ColumnType<S,I,U> = { __select__: S, __insert__: I, __update__: U },
// our branded types ARE subtypes of S, so Schema.make<ColumnType<...>>(ast) works.

/**
 * Variant marker using mapped type pattern from Effect's Brand.
 *
 * TypeScript cannot simplify mapped types that depend on generic parameters.
 * This ensures the variant information survives declaration emit (.d.ts generation).
 *
 * Pattern derived from Effect's Brand<K>:
 * ```typescript
 * readonly [BrandTypeId]: { readonly [k in K]: K }  // Mapped type - cannot be simplified!
 * ```
 *
 * Our pattern uses a conditional type within the mapped type to encode both I and U:
 * ```typescript
 * readonly [VariantTypeId]: { readonly [K in "insert" | "update"]: K extends "insert" ? I : U }
 * ```
 */
export interface VariantMarker<in out I, in out U> {
  readonly [VariantTypeId]: {
    readonly [K in 'insert' | 'update']: K extends 'insert' ? I : U;
  };
}

/**
 * Branded ColumnType that extends S while carrying phantom insert/update type information.
 *
 * This replaces Kysely's ColumnType because:
 * 1. Kysely's ColumnType<S,I,U> = { __select__: S, __insert__: I, __update__: U } is NOT a subtype of S
 * 2. Schema.make<KyselyColumnType<...>>(ast) doesn't work because AST represents S, not the struct
 * 3. Our ColumnType<S,I,U> = S & Brand IS a subtype of S, so Schema.make works correctly
 *
 * Includes Kysely's phantom properties (__select__, __insert__, __update__) so that:
 * 1. Kysely recognizes this as a ColumnType for INSERT/UPDATE operations
 * 2. WHERE clauses work with plain S values (not branded)
 *
 * Uses VariantMarker with mapped types to survive TypeScript declaration emit.
 *
 * Usage is identical to Kysely's ColumnType:
 * ```typescript
 * type IdField = ColumnType<string, never, never>;  // Read-only ID
 * type CreatedAt = ColumnType<Date, Date | undefined, Date>;  // Optional on insert
 * ```
 */
export type ColumnType<S, I = S, U = S> = S &
  VariantMarker<I, U> & {
    /** Kysely extracts this type for SELECT and WHERE */
    readonly __select__: S;
    /** Kysely uses this for INSERT */
    readonly __insert__: I;
    /** Kysely uses this for UPDATE */
    readonly __update__: U;
  };

/**
 * Base Generated brand without Kysely phantom properties.
 * Used as the __select__ return type to preserve branding on SELECT.
 *
 * Uses VariantMarker<T | undefined, T> so that Generated fields are:
 * - Optional on insert (T | undefined) - can be provided or omitted
 * - Required on update (T) - must provide value if updating
 *
 * This differs from ColumnType<S, never, never> which completely excludes
 * the field from insert (used for auto-generated IDs).
 */
type GeneratedBrand<T> = T &
  VariantMarker<T | undefined, T> & {
    readonly [GeneratedId]: true;
  };

/**
 * Branded Generated type for database-generated fields.
 *
 * Follows @effect/sql Model.Generated pattern - the field is:
 * - Required on select (T) - Kysely returns the base type
 * - Optional on insert (T | undefined) - Kysely recognizes this
 * - Allowed on update (T)
 *
 * Includes Kysely's phantom properties (__select__, __insert__, __update__) so that:
 * 1. Kysely recognizes this as a ColumnType and makes it optional on INSERT
 * 2. WHERE clauses work with plain T values (not branded)
 *
 * The Selectable<T> type utility preserves the full Generated<T> type for schema alignment.
 * Kysely operations work with the underlying T type.
 *
 * Uses VariantMarker with mapped types to survive TypeScript declaration emit.
 */
export type Generated<T> = GeneratedBrand<T> & {
  /** Kysely extracts this type for SELECT and WHERE - base type for compatibility */
  readonly __select__: T;
  /** Kysely uses this for INSERT - optional */
  readonly __insert__: T | undefined;
  /** Kysely uses this for UPDATE */
  readonly __update__: T;
};

// ============================================================================
// Runtime Annotation Schemas
// ============================================================================

interface ColumnTypeSchemas<
  SType,
  SEncoded,
  SRD,
  SRE,
  IType,
  IEncoded,
  IRD,
  IRE,
  UType,
  UEncoded,
  URD,
  URE,
> {
  selectSchema: Schema.Codec<SType, SEncoded, SRD, SRE>;
  insertSchema: Schema.Codec<IType, IEncoded, IRD, IRE>;
  updateSchema: Schema.Codec<UType, UEncoded, URD, URE>;
}

/**
 * Type alias for ColumnType schema — preserves type parameters in declaration emit.
 *
 * The runtime value is exactly `S["Rebuild"]` (output of `Schema.annotate(...)(selectSchema)`)
 * intersected with `{ selectSchema: S }` (added via `Object.assign`). The intersection is
 * separately viewable as `Schema.Codec<ColumnType<...>, ColumnType<...>, RD, RE>` so
 * downstream consumers see the branded I/U variance without losing access to the
 * underlying `selectSchema` reference. Declared as a type intersection (not an
 * interface) so the construction matches the runtime shape with no coercion.
 */
export type ColumnTypeSchema<S extends Schema.Top, IType, UType> = S['Rebuild'] & {
  readonly selectSchema: S;
} & Schema.Codec<
    ColumnType<Schema.Schema.Type<S>, IType, UType>,
    ColumnType<Schema.Codec.Encoded<S>, IType, UType>,
    Schema.Codec.DecodingServices<S>,
    Schema.Codec.EncodingServices<S>
  >;

/**
 * Mark a field as having different types for select/insert/update
 * Used for ID fields with @default (read-only)
 *
 * The insert/update schemas are stored in annotations and used at runtime
 * to determine which fields to include in Insertable/Updateable schemas.
 *
 * Returns a ColumnTypeSchema which:
 * 1. Is a named interface (preserved in declaration emit)
 * 2. Contains the ColumnType<S, I, U> brand with Kysely phantom properties
 * 3. Includes the original schema via `selectSchema` property
 *
 * This enables Kysely to recognize fields with `__insert__: never` and omit them from INSERT.
 */
export const columnType = <
  SType,
  SEncoded,
  SRD,
  SRE,
  IType,
  IEncoded,
  IRD,
  IRE,
  UType,
  UEncoded,
  URD,
  URE,
>(
  selectSchema: Schema.Codec<SType, SEncoded, SRD, SRE>,
  insertSchema: Schema.Codec<IType, IEncoded, IRD, IRE>,
  updateSchema: Schema.Codec<UType, UEncoded, URD, URE>
) => {
  const schemas: ColumnTypeSchemas<
    SType,
    SEncoded,
    SRD,
    SRE,
    IType,
    IEncoded,
    IRD,
    IRE,
    UType,
    UEncoded,
    URD,
    URE
  > = {
    selectSchema,
    insertSchema,
    updateSchema,
  };
  // Return annotated schema with ColumnType brand at type level
  // The runtime annotation enables filtering in Insertable() function
  // The type-level brand enables Kysely to recognize INSERT/UPDATE constraints
  const annotated = Schema.annotate({ [ColumnTypeId]: schemas })(selectSchema);
  return Object.assign(annotated, { selectSchema }) as ColumnTypeSchema<
    Schema.Codec<SType, SEncoded, SRD, SRE>,
    IType,
    UType
  >;
};

/**
 * Interface for Generated schema - preserves type parameter in declaration emit.
 *
 * Named interfaces with type parameters are preserved by TypeScript in declaration files,
 * unlike anonymous intersection types which may be simplified.
 *
 * This follows the Schema.brand pattern from Effect which returns a named interface.
 */
/**
 * Type alias for Generated schema — see {@link ColumnTypeSchema} for the
 * matching runtime/type composition pattern.
 */
export type GeneratedSchema<S extends Schema.Top> = S['Rebuild'] & {
  readonly from: S;
} & Schema.Codec<
    Generated<Schema.Schema.Type<S>>,
    Generated<Schema.Codec.Encoded<S>>,
    Schema.Codec.DecodingServices<S>,
    Schema.Codec.EncodingServices<S>
  >;

/**
 * Mark a field as database-generated (omitted from insert)
 * Used for fields with @default
 *
 * Follows @effect/sql Model.Generated pattern:
 * - Present in select and update schemas
 * - OMITTED from insert schema (not optional, completely absent)
 *
 * Returns a GeneratedSchema<S> which:
 * 1. Is a named interface (preserved in declaration emit)
 * 2. Contains the Generated<T> brand using VariantMarker (mapped types survive emit)
 * 3. Includes the original schema via `from` property
 *
 * This enables CustomInsertable to filter out generated fields at compile time.
 */
export const generated = <S extends Schema.Top>(schema: S) => {
  // Return annotated schema with Generated brand at type level
  // The runtime annotation enables filtering in Insertable() function
  // The type-level brand enables filtering in CustomInsertable type utility
  const annotated = Schema.annotate({ [GeneratedId]: true })(schema);
  return Object.assign(annotated, { from: schema }) as GeneratedSchema<S>;
};

// ============================================================================
// JsonValue Schema (recursive JSON type for Prisma Json fields)
// ============================================================================

/**
 * Standard recursive JSON value type.
 *
 * Used instead of `Schema.Unknown` for Prisma `Json` fields because:
 * - `Schema.NullOr(Schema.Unknown)` resolves to `unknown` (null absorbed into unknown)
 * - This causes the TS language server to hit depth limits resolving Selectable<T>
 * - `Schema.NullOr(JsonValue)` stays concrete and resolvable
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue };

export const JsonValue: Schema.Codec<JsonValue, JsonValue> = Schema.suspend(
  (): Schema.Codec<JsonValue, JsonValue> =>
    Schema.Union([
      Schema.String,
      Schema.Number,
      Schema.Boolean,
      Schema.Null,
      Schema.Array(JsonValue),
      Schema.Record(Schema.String, JsonValue),
    ])
);

// ============================================================================
// Type Helpers (defined early for use in schema functions)
// ============================================================================

type AnyColumnTypeSchemas = ColumnTypeSchemas<
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown
>;

/**
 * Schema for validating column type annotations structure
 */
const ColumnTypeSchemasValidator = Schema.Struct({
  selectSchema: Schema.Any,
  insertSchema: Schema.Any,
  updateSchema: Schema.Any,
});

/**
 * Extract and validate column type schemas from AST annotations
 * Returns null if not a column type or validation fails
 */
function getColumnTypeSchemas(ast: AST.AST) {
  // User annotations live on the last `Check` when checks are present, so
  // `ast.annotations` is often `undefined` for schemas built with `.check(...)`.
  // `AST.resolve(ast)` resolves annotations from wherever they actually are.
  const anns = AST.resolve(ast);
  if (!anns || !(ColumnTypeId in anns)) {
    return null;
  }

  const annotation = (anns as Record<string, unknown>)[ColumnTypeId];
  const decoded = Schema.decodeUnknownOption(ColumnTypeSchemasValidator)(annotation);

  if (decoded._tag === 'None') {
    return null;
  }

  // The decoded value has the correct structure, and the annotation
  // was created by columnType() which ensures proper Schema types
  return annotation as AnyColumnTypeSchemas;
}

// ============================================================================
// Internal AST construction helpers
// ============================================================================
// AST nodes are immutable. To "modify" a node we construct a new instance via
// the concrete `_tag` constructor. Optional/mutable property metadata lives on
// the type AST's `Context`, set via `AST.optionalKey(...)` (the only public
// helper) or by calling the constructor with a freshly-built `AST.Context`.

const isStruct = (ast: AST.AST): ast is AST.Objects => AST.isObjects(ast);
const isUndef = (ast: AST.AST): boolean => AST.isUndefined(ast);
const isNever = (ast: AST.AST): boolean => AST.isNever(ast);

const reveal = <T, E, RD, RE>(schema: Schema.Codec<T, E, RD, RE>): Schema.Codec<T, E, RD, RE> =>
  Schema.revealCodec(schema);

const makeSchemaFromAst = (ast: AST.AST) => Schema.make(ast);

const isGeneratedType = (ast: AST.AST): boolean => {
  const anns = AST.resolve(ast);
  return anns ? GeneratedId in anns : false;
};

interface BaseOverrides {
  readonly annotations?: Schema.Annotations.Annotations | undefined;
  readonly checks?: AST.Checks | undefined;
  readonly context?: AST.Context | undefined;
}

/**
 * Reconstruct an AST node, optionally replacing any of `annotations`/`checks`/
 * `context` while preserving everything else (the `_tag`-specific data, the
 * encoding chain, and any field not named in `overrides`).
 *
 * Effect v4 does not expose `AST.annotate` / `AST.replaceChecks` /
 * `AST.replaceContext` helpers, so we dispatch on `_tag` and call the concrete
 * public constructor. Pass `undefined` to clear a field.
 */
const rebuildBase = (ast: AST.AST, overrides: BaseOverrides): AST.AST => {
  const annotations = 'annotations' in overrides ? overrides.annotations : ast.annotations;
  const checks = 'checks' in overrides ? overrides.checks : ast.checks;
  const context = 'context' in overrides ? overrides.context : ast.context;
  const encoding = ast.encoding;
  switch (ast._tag) {
    case 'Null':
      return new AST.Null(annotations, checks, encoding, context);
    case 'Undefined':
      return new AST.Undefined(annotations, checks, encoding, context);
    case 'Void':
      return new AST.Void(annotations, checks, encoding, context);
    case 'Never':
      return new AST.Never(annotations, checks, encoding, context);
    case 'Any':
      return new AST.Any(annotations, checks, encoding, context);
    case 'Unknown':
      return new AST.Unknown(annotations, checks, encoding, context);
    case 'String':
      return new AST.String(annotations, checks, encoding, context);
    case 'Number':
      return new AST.Number(annotations, checks, encoding, context);
    case 'Boolean':
      return new AST.Boolean(annotations, checks, encoding, context);
    case 'BigInt':
      return new AST.BigInt(annotations, checks, encoding, context);
    case 'Symbol':
      return new AST.Symbol(annotations, checks, encoding, context);
    case 'ObjectKeyword':
      return new AST.ObjectKeyword(annotations, checks, encoding, context);
    case 'Literal':
      return new AST.Literal(ast.literal, annotations, checks, encoding, context);
    case 'UniqueSymbol':
      return new AST.UniqueSymbol(ast.symbol, annotations, checks, encoding, context);
    case 'Enum':
      return new AST.Enum(ast.enums, annotations, checks, encoding, context);
    case 'TemplateLiteral':
      return new AST.TemplateLiteral(ast.parts, annotations, checks, encoding, context);
    case 'Arrays':
      return new AST.Arrays(
        ast.isMutable,
        ast.elements,
        ast.rest,
        annotations,
        checks,
        encoding,
        context
      );
    case 'Objects':
      return new AST.Objects(
        ast.propertySignatures,
        ast.indexSignatures,
        annotations,
        checks,
        encoding,
        context
      );
    case 'Union':
      return new AST.Union(ast.types, ast.mode, annotations, checks, encoding, context);
    case 'Suspend':
      return new AST.Suspend(ast.thunk, annotations, checks, encoding, context);
    case 'Declaration':
      return new AST.Declaration(
        ast.typeParameters,
        ast.run,
        annotations,
        checks,
        encoding,
        context
      );
  }
};

/**
 * Strip the listed annotation keys from an AST node. User-supplied annotations
 * may live on the node directly or on the last `Check` when checks are present;
 * this rebuilds both with the filtered annotation maps.
 */
const stripAnns = (ast: AST.AST, ids: ReadonlyArray<string>): AST.AST => {
  const stripFrom = (
    existing: Schema.Annotations.Annotations | undefined
  ): Schema.Annotations.Annotations | undefined => {
    if (!existing) return existing;
    const next: Schema.Annotations.Annotations = { ...existing };
    for (const id of ids) {
      delete (next as Record<string, unknown>)[id];
    }
    return next;
  };

  const nextAnns = stripFrom(ast.annotations);
  let result = ast;
  if (nextAnns !== ast.annotations) {
    result = rebuildBase(ast, { annotations: nextAnns });
  }

  const checks = result.checks;
  if (checks) {
    const [head, ...tail] = checks;
    // `last` is `tail`'s last element if any, otherwise `head`. Equivalent to
    // `checks[checks.length - 1]` but reachable through the `Checks` non-empty
    // tuple type so no widening cast is needed.
    const last = tail.length === 0 ? head : tail[tail.length - 1];
    const init = tail.length === 0 ? [] : tail.slice(0, tail.length - 1);
    const newCheckAnns = stripFrom(last.annotations as Schema.Annotations.Annotations | undefined);
    if (newCheckAnns !== last.annotations) {
      const newLast = last.annotate(newCheckAnns as Schema.Annotations.Filter);
      const newChecks: AST.Checks = tail.length === 0 ? [newLast] : [head, ...init, newLast];
      result = rebuildBase(result, { checks: newChecks });
    }
  }

  return result;
};

/**
 * Build a property's type AST with optional/mutable context applied.
 * Optional flag uses the public `AST.optionalKey(...)` helper. Mutable flag is
 * carried by rebuilding the AST with a new `Context` whose `isMutable` is true.
 */
const applyKeyContext = (
  ast: AST.AST,
  options: { readonly isOptional: boolean; readonly isMutable: boolean }
): AST.AST => {
  let result = ast;
  if (options.isOptional) {
    result = AST.optionalKey(result);
  }
  if (options.isMutable) {
    const existing = result.context;
    const merged = new AST.Context(
      existing?.isOptional ?? options.isOptional,
      true,
      existing?.defaultValue,
      existing?.annotations
    );
    result = rebuildBase(result, { context: merged });
  }
  return result;
};

const makePropertySignature = (
  name: PropertyKey,
  type: AST.AST,
  options: { readonly isOptional: boolean; readonly isMutable: boolean }
): AST.PropertySignature => new AST.PropertySignature(name, applyKeyContext(type, options));

const makeObjects = (
  propertySignatures: ReadonlyArray<AST.PropertySignature>,
  indexSignatures: ReadonlyArray<AST.IndexSignature>,
  annotations: Schema.Annotations.Annotations | undefined
): AST.Objects => new AST.Objects(propertySignatures, indexSignatures, annotations);

const makeUnion = (types: ReadonlyArray<AST.AST>): AST.AST => new AST.Union(types, 'anyOf');

const makeUndefined = (): AST.AST => AST.undefined;

/**
 * Rebuild an array AST as mutable. Returns the ast unchanged for non-array nodes,
 * since v4's `Schema.mutable` only applies to `Arrays` and rebuilding a leaf to be
 * "mutable" has no observable meaning.
 */
const makeMutableIfArray = (ast: AST.AST): AST.AST => {
  if (!AST.isArrays(ast)) return ast;
  return new AST.Arrays(
    true,
    ast.elements,
    ast.rest,
    ast.annotations,
    ast.checks,
    ast.encoding,
    ast.context
  );
};

const propIsOptional = (prop: AST.PropertySignature): boolean =>
  prop.type.context?.isOptional ?? false;

const propIsMutable = (prop: AST.PropertySignature): boolean =>
  prop.type.context?.isMutable ?? false;

const isOptionalType = (ast: AST.AST) => {
  // Check for Union(T, Undefined) or Union(T, null) patterns
  // These are optional on insert because omitting = NULL in DB
  if (!AST.isUnion(ast)) {
    return false;
  }

  return (
    ast.types.some((t: AST.AST) => isUndef(t)) || ast.types.some((t: AST.AST) => isNullType(t))
  );
};

const isNullType = (ast: AST.AST): boolean => AST.isNull(ast);

/**
 * Strip null from a union type for Insertable fields.
 * For INSERT operations, omitting a field = null in DB, so we don't need explicit null.
 * Returns the non-null type if it's a union with null, otherwise returns the original type.
 */
const stripNullFromUnion = (ast: AST.AST): AST.AST => {
  if (!AST.isUnion(ast)) {
    return ast;
  }

  // Filter out null types from the union
  const nonNullTypes = ast.types.filter((t: AST.AST) => !isNullType(t));

  // If only one type remains, return it directly (unwrap single-element union)
  if (nonNullTypes.length === 1) {
    return nonNullTypes[0];
  }

  // If multiple types remain, create a new union without null
  if (nonNullTypes.length > 1) {
    return makeUnion(nonNullTypes);
  }

  // Edge case: all types were null (shouldn't happen in practice)
  return ast;
};

const extractFieldsForVariant = (ast: AST.Objects, schemaType: keyof AnyColumnTypeSchemas) => {
  return ast.propertySignatures
    .map((prop: AST.PropertySignature): AST.PropertySignature | null => {
      const isOptional = propIsOptional(prop);
      const isMutable = propIsMutable(prop);
      const columnSchemas = getColumnTypeSchemas(prop.type);

      if (columnSchemas !== null) {
        const targetSchema = columnSchemas[schemaType];

        // Filter out fields whose insert/update schema is Schema.Never
        if (isNever(targetSchema.ast)) {
          return null;
        }

        // For insert/update, ensure array fields are mutable so Kysely accepts T[]
        const shouldBeMutable = schemaType === 'updateSchema' || schemaType === 'insertSchema';
        const typeAst = shouldBeMutable ? makeMutableIfArray(targetSchema.ast) : targetSchema.ast;
        return makePropertySignature(prop.name, typeAst, { isOptional, isMutable });
      }

      // For Selectable: unwrap Generated<T> to plain T by stripping the annotation
      if (schemaType === 'selectSchema' && isGeneratedType(prop.type)) {
        const baseAst = stripAnns(prop.type, [GeneratedId, ColumnTypeId]);
        return makePropertySignature(prop.name, baseAst, { isOptional, isMutable });
      }

      // For insert/update, ensure regular array fields are mutable
      if (schemaType === 'updateSchema' || schemaType === 'insertSchema') {
        return makePropertySignature(prop.name, makeMutableIfArray(prop.type), {
          isOptional,
          isMutable,
        });
      }

      // Selectable on regular fields: return as-is
      return prop;
    })
    .filter((prop): prop is AST.PropertySignature => prop !== null);
};

// ============================================================================
// Custom Type Utilities for Insert/Update
// ============================================================================
// Kysely's Insertable/Updateable don't properly omit fields with `never` insert types.
// These custom types handle ColumnType and Generated correctly.

/**
 * Extract the insert type from a field using the __insert__ phantom property:
 * - ColumnType<S, I, U> -> I (via __insert__)
 * - Generated<T> -> T | undefined (via __insert__)
 * - Other types -> as-is
 *
 * Uses the __insert__ property which is always present on ColumnType and Generated.
 * This approach is more reliable across module boundaries than using VariantMarker
 * with unique symbols, which can cause type matching failures when TypeScript
 * compiles from source files with different symbol references.
 */
type ExtractInsertType<T> = [T] extends [{ readonly __insert__: infer I }] ? I : T;

/**
 * Check if a type is nullable (includes null or undefined).
 * Matches Kysely's IfNullable behavior:
 *   type IfNullable<T, K> = undefined extends T ? K : null extends T ? K : never;
 *
 * A field is optional for insert if its InsertType can be null or undefined.
 */
type IsOptionalInsert<T> =
  undefined extends ExtractInsertType<T> ? true : null extends ExtractInsertType<T> ? true : false;

/**
 * Extract the base type without null/undefined for optional fields.
 * Keeps the type as-is (including null) for the property type,
 * since the optionality is expressed via `?` not the type itself.
 */
type ExtractInsertBaseType<T> = ExtractInsertType<T>;

/**
 * Extract the update type from a field using the __update__ phantom property:
 * - ColumnType<S, I, U> -> U (via __update__)
 * - Generated<T> -> T (via __update__)
 * - Other types -> as-is
 *
 * Uses the __update__ property which is always present on ColumnType and Generated.
 * This approach is more reliable across module boundaries than using VariantMarker
 * with unique symbols, which can cause type matching failures when TypeScript
 * compiles from source files with different symbol references.
 */
type ExtractUpdateType<T> = [T] extends [{ readonly __update__: infer U }] ? U : T;

/**
 * Custom Insertable type that:
 * - Omits fields with `never` insert type (read-only IDs)
 * - Makes fields with `T | undefined` insert type optional with type T
 * - Keeps other fields required
 */
type CustomInsertable<T> =
  // Required fields (insert type doesn't include undefined)
  {
    -readonly [K in keyof T as ExtractInsertType<T[K]> extends never
      ? never
      : IsOptionalInsert<T[K]> extends true
        ? never
        : K]: ExtractInsertType<T[K]>;
  } & {
    // Optional fields (insert type includes undefined)
    -readonly [K in keyof T as ExtractInsertType<T[K]> extends never
      ? never
      : IsOptionalInsert<T[K]> extends true
        ? K
        : never]?: ExtractInsertBaseType<T[K]>;
  };

/**
 * Custom Updateable type that properly omits fields with `never` update types.
 */
type CustomUpdateable<T> = {
  -readonly [K in keyof T as ExtractUpdateType<T[K]> extends never ? never : K]?: ExtractUpdateType<
    T[K]
  >;
};

// Legacy aliases for backwards compatibility
type MutableInsert<Type> = CustomInsertable<Type>;
type MutableUpdate<Type> = CustomUpdateable<Type>;

// ============================================================================
// Stripping Type Utilities (needed for Selectable function return type)
// ============================================================================

/**
 * Strip Generated<T> wrapper, returning the underlying type T.
 * For non-Generated types, returns as-is.
 * Preserves branded foreign keys (UserId, ProductId, etc.).
 */
type StripGeneratedWrapper<T> = [T] extends [GeneratedBrand<infer U>] ? U : T;

/**
 * Strip ColumnType wrapper, extracting the select type S.
 * Must check AFTER Generated because Generated<T> also has __select__.
 * Uses __insert__ existence to differentiate ColumnType from other types.
 */
type StripColumnTypeWrapper<T> = [T] extends [
  {
    readonly __select__: infer S;
    readonly __insert__: unknown;
  },
]
  ? S
  : T;

/**
 * Strip all Kysely wrappers (Generated, ColumnType) from a field type.
 * Order matters: check Generated first, then ColumnType.
 * Preserves branded foreign keys (UserId, ProductId, etc.).
 */
type StripKyselyWrapper<T> = StripColumnTypeWrapper<StripGeneratedWrapper<T>>;

/**
 * Strip Kysely wrappers from all fields in a type.
 * Preserves branded foreign keys (UserId, ProductId, etc.).
 */
type StripKyselyWrappersFromObject<T> = {
  readonly [K in keyof T]: StripKyselyWrapper<T[K]>;
};

// ============================================================================
// Schema Functions
// ============================================================================

export function Selectable<Type, Encoded>(
  schema: Schema.Codec<Type, Encoded>
): Schema.Codec<StripKyselyWrappersFromObject<Type>, StripKyselyWrappersFromObject<Encoded>> {
  // Strip Generated/ColumnType wrappers to match what Kysely returns from queries
  // Branded foreign keys (UserId, ProductId) are preserved
  const { ast } = schema;
  if (!isStruct(ast)) {
    // Non-struct schemas: identity. Internal cast needed because Schema.make(ast)
    // returns the input schema's type parameters, which we narrow at the boundary.
    return reveal(makeSchemaFromAst(ast)) as Schema.Codec<
      StripKyselyWrappersFromObject<Type>,
      StripKyselyWrappersFromObject<Encoded>
    >;
  }
  // Extract select schemas from annotated fields (strips wrappers at runtime)
  return reveal(
    makeSchemaFromAst(
      makeObjects(
        extractFieldsForVariant(ast, 'selectSchema'),
        ast.indexSignatures,
        ast.annotations
      )
    )
  ) as Schema.Codec<StripKyselyWrappersFromObject<Type>, StripKyselyWrappersFromObject<Encoded>>;
}

/**
 * Create Insertable schema from base schema
 * Generated fields (@default) are made optional, not excluded
 */
export function Insertable<Type, Encoded>(schema: Schema.Codec<Type, Encoded>) {
  const { ast } = schema;
  if (!isStruct(ast)) {
    return reveal(makeSchemaFromAst(ast)) as Schema.Codec<
      MutableInsert<Type>,
      MutableInsert<Encoded>
    >;
  }

  const extracted = extractFieldsForVariant(ast, 'insertSchema');

  const fields = extracted.map((prop) => {
    const isMutable = propIsMutable(prop);
    // Check if this is a Generated field - make it optional
    const isGenerated = isGeneratedType(prop.type);

    // Make Union(T, null) fields optional and strip null from the type
    // For INSERT, omitting a field = null in DB, so explicit null is unnecessary
    const isOptional = isOptionalType(prop.type) || isGenerated;

    // For generated fields, unwrap the base type from the Generated annotation
    let fieldType = prop.type;
    if (isGenerated) {
      fieldType = stripAnns(prop.type, [GeneratedId]);
    } else if (isOptionalType(prop.type)) {
      fieldType = stripNullFromUnion(prop.type);
    }

    return makePropertySignature(prop.name, fieldType, { isOptional, isMutable });
  });

  return reveal(
    makeSchemaFromAst(makeObjects(fields, ast.indexSignatures, ast.annotations))
  ) as Schema.Codec<MutableInsert<Type>, MutableInsert<Encoded>>;
}

/**
 * Create Updateable schema from base schema
 */
export function Updateable<Type, Encoded>(schema: Schema.Codec<Type, Encoded>) {
  const { ast } = schema;
  if (!isStruct(ast)) {
    return reveal(makeSchemaFromAst(ast)) as Schema.Codec<
      MutableUpdate<Type>,
      MutableUpdate<Encoded>
    >;
  }

  const extracted = extractFieldsForVariant(ast, 'updateSchema');

  const res = makeObjects(
    extracted.map((prop) =>
      makePropertySignature(prop.name, makeUnion([prop.type, makeUndefined()]), {
        isOptional: true,
        isMutable: propIsMutable(prop),
      })
    ),
    ast.indexSignatures,
    ast.annotations
  );

  return reveal(makeSchemaFromAst(res)) as Schema.Codec<
    MutableUpdate<Type>,
    MutableUpdate<Encoded>
  >;
}

// ============================================================================
// Type Utilities (Work directly with Schema types)
// Usage: Selectable<User>, Insertable<User>, Updateable<User>
// Note: Stripping types are defined earlier in the file (before schema functions)
// ============================================================================

/**
 * Extract SELECT type from schema.
 * - Preserves branded foreign keys (UserId, ProductId, etc.)
 * - Strips Generated<T> and ColumnType<S,I,U> wrappers to match what Kysely returns
 *
 * Kysely extracts __select__ for SELECT results.
 * Generated<T>/ColumnType remain in the DB interface for INSERT recognition,
 * but Selectable<T> gives you the clean type matching query results.
 *
 * @example type UserSelect = Selectable<User>;
 */
export type Selectable<T extends Schema.Top> = StripKyselyWrappersFromObject<Schema.Schema.Type<T>>;

/**
 * Extract INSERT type from schema.
 * Omits fields with `never` insert type (read-only IDs, generated fields).
 * @example type UserInsert = Insertable<User>;
 */
export type Insertable<T extends Schema.Top> = CustomInsertable<Schema.Schema.Type<T>>;

/**
 * Extract UPDATE type from schema.
 * Omits fields with `never` update type, makes all fields optional.
 * @example type UserUpdate = Updateable<User>;
 */
export type Updateable<T extends Schema.Top> = CustomUpdateable<Schema.Schema.Type<T>>;
