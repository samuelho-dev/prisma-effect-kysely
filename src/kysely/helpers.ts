import { Schema } from 'effect';
import * as AST from 'effect/SchemaAST';
import type {
  Insertable as KyselyInsertable,
  Selectable as KyselySelectable,
  Updateable as KyselyUpdateable,
  ColumnType as KyselyColumnType,
  Generated as KyselyGenerated,
} from 'kysely';
import type { DeepMutable } from 'effect/Types';

/**
 * Runtime helpers for Kysely schema integration
 * These are imported by generated code
 *
 * ## Type Extraction Patterns
 *
 * For Effect Schemas (recommended - full type safety):
 * ```typescript
 * import { Selectable, Insertable, Updateable, ColumnType, Generated } from 'prisma-effect-kysely/kysely';
 * import { User } from './generated/types';
 *
 * type UserSelect = Selectable<typeof User>;
 * type UserInsert = Insertable<typeof User>;
 * type UserUpdate = Updateable<typeof User>;
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

export const ColumnTypeId = Symbol.for('/ColumnTypeId');
export const GeneratedId = Symbol.for('/GeneratedId');

// ============================================================================
// Branded Type Definitions (Override Kysely's types)
// ============================================================================
// These branded types extend S while carrying phantom insert/update information.
// Unlike Kysely's ColumnType<S,I,U> = { __select__: S, __insert__: I, __update__: U },
// our branded types ARE subtypes of S, so Schema.make<ColumnType<...>>(ast) works.

/**
 * Branded ColumnType that extends S while carrying phantom insert/update type information.
 *
 * This replaces Kysely's ColumnType because:
 * 1. Kysely's ColumnType<S,I,U> = { __select__: S, __insert__: I, __update__: U } is NOT a subtype of S
 * 2. Schema.make<KyselyColumnType<...>>(ast) doesn't work because AST represents S, not the struct
 * 3. Our ColumnType<S,I,U> = S & Brand IS a subtype of S, so Schema.make works correctly
 *
 * Usage is identical to Kysely's ColumnType:
 * ```typescript
 * type IdField = ColumnType<string, never, never>;  // Read-only ID
 * type CreatedAt = ColumnType<Date, Date | undefined, Date>;  // Optional on insert
 * ```
 */
export type ColumnType<S, I = S, U = S> = S & {
  readonly [ColumnTypeId]: { readonly __insert__: I; readonly __update__: U };
};

/**
 * Branded Generated type for database-generated fields.
 *
 * Equivalent to ColumnType<T, T | undefined, T> - the field is:
 * - Required on select (T)
 * - Optional on insert (T | undefined)
 * - Allowed on update (T)
 */
export type Generated<T> = T & {
  readonly [GeneratedId]: true;
  readonly [ColumnTypeId]: { readonly __insert__: T | undefined; readonly __update__: T };
};

// ============================================================================
// Runtime Annotation Schemas
// ============================================================================

interface ColumnTypeSchemas<SType, SEncoded, SR, IType, IEncoded, IR, UType, UEncoded, UR> {
  selectSchema: Schema.Schema<SType, SEncoded, SR>;
  insertSchema: Schema.Schema<IType, IEncoded, IR>;
  updateSchema: Schema.Schema<UType, UEncoded, UR>;
}

/**
 * Mark a field as having different types for select/insert/update
 * Used for ID fields with @default (read-only)
 *
 * The insert/update schemas are stored in annotations and used at runtime
 * to determine which fields to include in Insertable/Updateable schemas.
 *
 * Returns a schema with our branded ColumnType<S,I,U> that extends S, ensuring:
 * 1. TypeScript correctly infers the return type across module boundaries
 * 2. Runtime decode returns S values (not wrapped structs)
 * 3. Type utilities can extract I and U from the brand
 */
export const columnType = <SType, SEncoded, SR, IType, IEncoded, IR, UType, UEncoded, UR>(
  selectSchema: Schema.Schema<SType, SEncoded, SR>,
  insertSchema: Schema.Schema<IType, IEncoded, IR>,
  updateSchema: Schema.Schema<UType, UEncoded, UR>
): Schema.Schema<ColumnType<SType, IType, UType>, SEncoded, SR> => {
  const schemas: ColumnTypeSchemas<SType, SEncoded, SR, IType, IEncoded, IR, UType, UEncoded, UR> =
    {
      selectSchema,
      insertSchema,
      updateSchema,
    };
  const annotated = selectSchema.annotations({ [ColumnTypeId]: schemas });
  // ColumnType<S,I,U> extends S, so this type assertion is valid
  // because the runtime value IS of type S
  return Schema.make<ColumnType<SType, IType, UType>, SEncoded, SR>(annotated.ast);
};

/**
 * Mark a field as database-generated (omitted from insert)
 * Used for fields with @default
 *
 * Follows @effect/sql Model.Generated pattern:
 * - Present in select and update schemas
 * - OMITTED from insert schema (not optional, completely absent)
 *
 * Returns a schema with our branded Generated<T> that extends T, ensuring:
 * 1. TypeScript correctly infers the return type across module boundaries
 * 2. Runtime decode returns T values (not wrapped structs)
 */
export const generated = <SType, SEncoded, R>(
  schema: Schema.Schema<SType, SEncoded, R>
): Schema.Schema<Generated<SType>, SEncoded, R> => {
  const annotated = schema.annotations({ [GeneratedId]: true });
  // Generated<T> extends T, so this type assertion is valid
  return Schema.make<Generated<SType>, SEncoded, R>(annotated.ast);
};

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
function getColumnTypeSchemas(ast: AST.AST): AnyColumnTypeSchemas | null {
  if (!(ColumnTypeId in ast.annotations)) {
    return null;
  }

  const annotation = ast.annotations[ColumnTypeId];
  const decoded = Schema.decodeUnknownOption(ColumnTypeSchemasValidator)(annotation);

  if (decoded._tag === 'None') {
    return null;
  }

  // The decoded value has the correct structure, and the annotation
  // was created by columnType() which ensures proper Schema types
  return annotation as AnyColumnTypeSchemas;
}

const isGeneratedType = (ast: AST.AST): boolean => GeneratedId in ast.annotations;

const isOptionalType = (ast: AST.AST): boolean => {
  // Check for Union(T, Undefined) pattern
  if (!AST.isUnion(ast)) {
    return false;
  }

  return (
    ast.types.some((t: AST.AST) => AST.isUndefinedKeyword(t)) ||
    ast.types.some((t: AST.AST) => isNullType(t))
  );
};

const isNullType = (ast: AST.AST) =>
  AST.isLiteral(ast) &&
  Object.entries(ast.annotations).find(
    ([sym, value]) => sym === AST.IdentifierAnnotationId.toString() && value === 'null'
  );

const extractParametersFromTypeLiteral = (
  ast: AST.TypeLiteral,
  schemaType: keyof AnyColumnTypeSchemas
) => {
  return ast.propertySignatures
    .map((prop: AST.PropertySignature) => {
      const columnSchemas = getColumnTypeSchemas(prop.type);

      if (columnSchemas !== null) {
        const targetSchema = columnSchemas[schemaType];

        // Check for Schema.Never BEFORE mutable transformation
        // Schema.mutable() wraps in Transformation node, changing _tag
        if (AST.isNeverKeyword(targetSchema.ast)) {
          return null; // Will be filtered out
        }

        // Use Schema.mutable() for insert/update schema to make arrays mutable
        // Kysely expects mutable T[] for insert/update operations
        const shouldBeMutable = schemaType === 'updateSchema' || schemaType === 'insertSchema';
        return new AST.PropertySignature(
          prop.name,
          shouldBeMutable ? Schema.mutable(targetSchema).ast : targetSchema.ast,
          prop.isOptional,
          prop.isReadonly,
          prop.annotations
        );
      }

      // Apply Schema.mutable() to regular fields for insert/updateSchema to make arrays mutable
      // Safe for all types - no-op for non-arrays
      if (schemaType === 'updateSchema' || schemaType === 'insertSchema') {
        return new AST.PropertySignature(
          prop.name,
          Schema.mutable(Schema.asSchema(Schema.make(prop.type))).ast,
          prop.isOptional,
          prop.isReadonly,
          prop.annotations
        );
      }

      // Generated fields are just markers now, return as-is
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
 * Extract the insert type from a field:
 * - ColumnType<S, I, U> -> I (via brand)
 * - Generated<T> -> T | undefined (via brand)
 * - Other types -> as-is
 */
type ExtractInsertType<T> = T extends { readonly [ColumnTypeId]: { readonly __insert__: infer I } }
  ? I
  : T;

/**
 * Extract the update type from a field:
 * - ColumnType<S, I, U> -> U (via brand)
 * - Generated<T> -> T (via brand)
 * - Other types -> as-is
 */
type ExtractUpdateType<T> = T extends { readonly [ColumnTypeId]: { readonly __update__: infer U } }
  ? U
  : T;

/**
 * Custom Insertable type that properly omits fields with `never` insert types.
 * This is needed because Kysely's Insertable includes never fields which makes types unusable.
 */
type CustomInsertable<T> = DeepMutable<{
  [K in keyof T as ExtractInsertType<T[K]> extends never ? never : K]: ExtractInsertType<T[K]>;
}>;

/**
 * Custom Updateable type that properly omits fields with `never` update types.
 */
type CustomUpdateable<T> = DeepMutable<{
  [K in keyof T as ExtractUpdateType<T[K]> extends never ? never : K]?: ExtractUpdateType<T[K]>;
}>;

// Legacy aliases for backwards compatibility
type MutableInsert<Type> = CustomInsertable<Type>;
type MutableUpdate<Type> = CustomUpdateable<Type>;

// ============================================================================
// Branding Utilities (for Schema functions)
// ============================================================================
// These utilities strip the ColumnType/Generated branding to get plain types.

/**
 * Strip branding from a single field type.
 *
 * Uses explicit symbol check rather than conditional inference because
 * TypeScript's `infer` with intersection types can be unreliable.
 *
 * For branded types (ColumnType<S,I,U> = S & {...} or Generated<T> = T & {...}),
 * we check for the brand symbol and extract the base primitive type.
 */
type StripFieldBranding<T> = T extends { readonly [ColumnTypeId]: unknown }
  ? // Has ColumnType branding - extract base type by checking primitives
    T extends string
    ? string
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T extends Date
          ? Date
          : T extends readonly (infer E)[]
            ? readonly E[]
            : T extends (infer E)[]
              ? E[]
              : T // Unknown branded type, keep as-is (shouldn't happen)
  : T extends { readonly [GeneratedId]: true }
    ? // Has Generated branding without ColumnType - same extraction
      T extends string
      ? string
      : T extends number
        ? number
        : T extends boolean
          ? boolean
          : T extends Date
            ? Date
            : T extends readonly (infer E)[]
              ? readonly E[]
              : T extends (infer E)[]
                ? E[]
                : T
    : // No branding - return as-is
      T;

/**
 * Strip branding from all properties in an object type.
 * Converts ColumnType<S,I,U> to S and Generated<T> to T.
 */
type StripBrandingFromObject<T> = {
  [K in keyof T]: StripFieldBranding<T[K]>;
};

/**
 * Selectable type with branding stripped - used for Schema function return types.
 * This ensures that `Schema.Type` returns plain types without ColumnType/Generated branding.
 *
 * Note: We apply StripBrandingFromObject directly instead of using KyselySelectable
 * because KyselySelectable adds unnecessary complexity and our branding is already
 * designed to extend the base type.
 */
type SelectableType<T> = StripBrandingFromObject<T>;

// ============================================================================
// Schema Functions
// ============================================================================

export const Selectable = <Type, Encoded>(
  schema: Schema.Schema<Type, Encoded>
): Schema.Schema<SelectableType<Type>, SelectableType<Encoded>, never> => {
  const { ast } = schema;
  if (!AST.isTypeLiteral(ast)) {
    return Schema.asSchema(Schema.make<SelectableType<Type>, SelectableType<Encoded>, never>(ast));
  }
  return Schema.asSchema(
    Schema.make<SelectableType<Type>, SelectableType<Encoded>, never>(
      new AST.TypeLiteral(
        extractParametersFromTypeLiteral(ast, 'selectSchema'),
        ast.indexSignatures,
        ast.annotations
      )
    )
  );
};

/**
 * Create Insertable schema from base schema
 * Filters out generated fields (@effect/sql Model.Generated pattern)
 */
export const Insertable = <Type, Encoded>(
  schema: Schema.Schema<Type, Encoded>
): Schema.Schema<MutableInsert<Type>, MutableInsert<Encoded>, never> => {
  const { ast } = schema;
  if (!AST.isTypeLiteral(ast)) {
    return Schema.asSchema(Schema.make<MutableInsert<Type>, MutableInsert<Encoded>, never>(ast));
  }

  // Extract and filter out generated fields entirely
  const nonGeneratedProps = ast.propertySignatures.filter((prop) => !isGeneratedType(prop.type));

  const filteredAst = new AST.TypeLiteral(nonGeneratedProps, ast.indexSignatures, ast.annotations);

  const extracted = extractParametersFromTypeLiteral(filteredAst, 'insertSchema');

  const fields = extracted.map((prop) => {
    // Make Union(T, Undefined) fields optional
    const isOptional = isOptionalType(prop.type);

    return new AST.PropertySignature(
      prop.name,
      prop.type,
      isOptional,
      prop.isReadonly,
      prop.annotations
    );
  });

  return Schema.asSchema(
    Schema.make<MutableInsert<Type>, MutableInsert<Encoded>, never>(
      new AST.TypeLiteral(fields, ast.indexSignatures, ast.annotations)
    )
  );
};

/**
 * Create Updateable schema from base schema
 */
export const Updateable = <Type, Encoded>(
  schema: Schema.Schema<Type, Encoded>
): Schema.Schema<MutableUpdate<Type>, MutableUpdate<Encoded>, never> => {
  const { ast } = schema;
  if (!AST.isTypeLiteral(ast)) {
    return Schema.asSchema(Schema.make<MutableUpdate<Type>, MutableUpdate<Encoded>, never>(ast));
  }

  const extracted = extractParametersFromTypeLiteral(ast, 'updateSchema');

  const res = new AST.TypeLiteral(
    extracted.map(
      (prop) =>
        new AST.PropertySignature(
          prop.name,
          AST.Union.make([prop.type, new AST.UndefinedKeyword()]),
          true,
          prop.isReadonly,
          prop.annotations
        )
    ),
    ast.indexSignatures,
    ast.annotations
  );

  return Schema.asSchema(Schema.make<MutableUpdate<Type>, MutableUpdate<Encoded>, never>(res));
};

/**
 * Schemas interface returned by getSchemas().
 * Includes a _base property to preserve the original schema for type-level computations.
 *
 * Uses Schema.Schema<unknown, unknown, unknown> constraint instead of Schema.Schema.Any
 * to prevent type widening (Schema.Any uses `any` which causes Id to compile as `any`).
 */
export interface Schemas<BaseSchema extends Schema.Schema<unknown, unknown, unknown>> {
  readonly _base: BaseSchema;
  readonly Selectable: Schema.Schema<
    SelectableType<Schema.Schema.Type<BaseSchema>>,
    SelectableType<Schema.Schema.Encoded<BaseSchema>>,
    never
  >;
  readonly Insertable: Schema.Schema<
    MutableInsert<Schema.Schema.Type<BaseSchema>>,
    MutableInsert<Schema.Schema.Encoded<BaseSchema>>,
    never
  >;
  readonly Updateable: Schema.Schema<
    MutableUpdate<Schema.Schema.Type<BaseSchema>>,
    MutableUpdate<Schema.Schema.Encoded<BaseSchema>>,
    never
  >;
}

/**
 * Extended Schemas interface with branded Id type.
 * Returned when getSchemas() is called with an idSchema parameter.
 */
export interface SchemasWithId<
  BaseSchema extends Schema.Schema<unknown, unknown, unknown>,
  IdSchema extends Schema.Schema<unknown, unknown, unknown>,
> extends Schemas<BaseSchema> {
  readonly Id: IdSchema;
}

/**
 * Generate all operational schemas (Selectable/Insertable/Updateable) from base schema
 * Used in generated code
 *
 * @param baseSchema - The base Effect Schema struct
 * @param idSchema - Optional branded ID schema for models with @id fields
 */
export function getSchemas<
  BaseSchema extends Schema.Schema<unknown, unknown, unknown>,
  IdSchema extends Schema.Schema<unknown, unknown, unknown>,
>(baseSchema: BaseSchema, idSchema: IdSchema): SchemasWithId<BaseSchema, IdSchema>;

export function getSchemas<BaseSchema extends Schema.Schema<unknown, unknown, unknown>>(
  baseSchema: BaseSchema
): Schemas<BaseSchema>;

export function getSchemas<
  BaseSchema extends Schema.Schema<unknown, unknown, unknown>,
  IdSchema extends Schema.Schema<unknown, unknown, unknown>,
>(
  baseSchema: BaseSchema,
  idSchema?: IdSchema
): Schemas<BaseSchema> | SchemasWithId<BaseSchema, IdSchema> {
  // Use type assertion via unknown to handle Schema.Any -> Schema<Type, Encoded> conversion
  // This is safe because Schema.Any is a supertype of all Schema types
  const schema = baseSchema as unknown as Schema.Schema<
    Schema.Schema.Type<BaseSchema>,
    Schema.Schema.Encoded<BaseSchema>
  >;

  const base: Schemas<BaseSchema> = {
    _base: baseSchema,
    Selectable: Selectable(schema),
    Insertable: Insertable(schema),
    Updateable: Updateable(schema),
  };

  if (idSchema) {
    return { ...base, Id: idSchema } as SchemasWithId<BaseSchema, IdSchema>;
  }

  return base;
}

// ============================================================================
// Type Utilities (Kysely-compatible pattern)
// Usage: Selectable<typeof User>, Insertable<typeof User>
// ============================================================================

/**
 * Extract SELECT type from schema (matches Kysely's Selectable<T> pattern)
 *
 * Simply extracts Schema.Type - no additional transformations needed
 * because the schema function already handles branding removal.
 *
 * This ensures: Selectable<typeof User> === typeof User.Selectable.Type
 *
 * @example type UserSelect = Selectable<typeof User>
 */
export type Selectable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends { readonly Selectable: Schema.Schema<any, any, any> },
> = Schema.Schema.Type<T['Selectable']>;

/**
 * Extract INSERT type from schema (matches Kysely's Insertable<T> pattern)
 *
 * Simply extracts Schema.Type - the schema function already handles
 * field filtering and type transformations.
 *
 * This ensures: Insertable<typeof User> === typeof User.Insertable.Type
 *
 * @example type UserInsert = Insertable<typeof User>
 */
export type Insertable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends { readonly Insertable: Schema.Schema<any, any, any> },
> = Schema.Schema.Type<T['Insertable']>;

/**
 * Extract UPDATE type from schema (matches Kysely's Updateable<T> pattern)
 *
 * Simply extracts Schema.Type - the schema function already handles
 * field filtering and optional transformations.
 *
 * This ensures: Updateable<typeof User> === typeof User.Updateable.Type
 *
 * @example type UserUpdate = Updateable<typeof User>
 */
export type Updateable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends { readonly Updateable: Schema.Schema<any, any, any> },
> = Schema.Schema.Type<T['Updateable']>;

/**
 * Extract branded ID type from schema
 * @example type UserId = Id<typeof User>
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Id<T extends { Id: Schema.Schema<any, any, any> }> = Schema.Schema.Type<T['Id']>;
