import { Schema } from 'effect';
import * as AST from 'effect/SchemaAST';
import type {
  Insertable as KyselyInsertable,
  Selectable as KyselySelectable,
  Updateable as KyselyUpdateable,
} from 'kysely';
import type { DeepMutable } from 'effect/Types';

/**
 * Runtime helpers for Kysely schema integration
 * These are imported by generated code
 *
 * ## Type Extraction Patterns
 *
 * For Kysely Table Interfaces (recommended for type-safe queries):
 * ```typescript
 * import type { Selectable, Insertable, Updateable } from 'kysely';
 * import { UserTable } from './generated/types';
 *
 * type UserSelect = Selectable<UserTable>;   // All fields
 * type UserInsert = Insertable<UserTable>;   // Excludes ColumnType<S, never, U>
 * type UserUpdate = Updateable<UserTable>;   // Excludes ColumnType<S, I, never>
 * ```
 *
 * For Effect Schemas (runtime validation):
 * ```typescript
 * import { Selectable, Insertable, Updateable } from 'prisma-effect-kysely/kysely';
 * import { User } from './generated/types';
 *
 * type UserSelect = Selectable<typeof User>;
 * type UserInsert = Insertable<typeof User>;
 * type UserUpdate = Updateable<typeof User>;
 * ```
 */

// Re-export Kysely's native type utilities for use with table interfaces
export type { KyselySelectable, KyselyInsertable, KyselyUpdateable };

export const ColumnTypeId = Symbol.for('/ColumnTypeId');
export const GeneratedId = Symbol.for('/GeneratedId');

// ============================================================================
// Kysely-Compatible Type Brands
// ============================================================================
// These mirror Kysely's ColumnType and Generated patterns exactly.
// This allows Kysely's Insertable<T> and Updateable<T> to work directly.

import type { ColumnType, Generated } from 'kysely';

// Re-export for use in generated code
export type { ColumnType, Generated };

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
 * The return type uses Kysely's ColumnType<S, I, U> so that Kysely's
 * Insertable<T> and Updateable<T> type utilities work correctly.
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
 * The return type uses Kysely's Generated<T> so that Kysely's
 * Insertable<T> makes this field optional.
 */
export const generated = <SType, SEncoded, R>(
  schema: Schema.Schema<SType, SEncoded, R>
): Schema.Schema<Generated<SType>, SEncoded, R> => {
  const annotated = schema.annotations({ [GeneratedId]: true });
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
 * - ColumnType<S, I, U> -> I
 * - Generated<T> -> T | undefined (optional)
 * - Other types -> as-is
 */
type ExtractInsertType<T> = T extends ColumnType<any, infer I, any> ? I : T;

/**
 * Extract the update type from a field:
 * - ColumnType<S, I, U> -> U
 * - Other types -> as-is
 */
type ExtractUpdateType<T> = T extends ColumnType<any, any, infer U> ? U : T;

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
// Schema Functions
// ============================================================================

export const Selectable = <Type, Encoded>(
  schema: Schema.Schema<Type, Encoded>
): Schema.Schema<KyselySelectable<Type>, KyselySelectable<Encoded>, never> => {
  const { ast } = schema;
  if (!AST.isTypeLiteral(ast)) {
    return Schema.asSchema(
      Schema.make<KyselySelectable<Type>, KyselySelectable<Encoded>, never>(ast)
    );
  }
  return Schema.asSchema(
    Schema.make<KyselySelectable<Type>, KyselySelectable<Encoded>, never>(
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
    KyselySelectable<Schema.Schema.Type<BaseSchema>>,
    KyselySelectable<Schema.Schema.Encoded<BaseSchema>>,
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
 * Remove index signatures to get strict object type
 */
type RemoveIndexSignature<T> = {
  [K in keyof T as K extends string
    ? string extends K
      ? never
      : K
    : K extends number
      ? number extends K
        ? never
        : K
      : K extends symbol
        ? symbol extends K
          ? never
          : K
        : K]: T[K];
};

/**
 * Remove properties with never values from an object type.
 * Also removes properties that are only `undefined` (from `never | undefined` simplifying to `undefined`).
 * This handles ColumnType<Select, never, never> for id fields in Insertable/Updateable.
 */
type OmitNever<T> = {
  [K in keyof T as T[K] extends never
    ? never
    : [Exclude<T[K], undefined>] extends [never]
      ? never
      : K]: T[K];
};

type StrictType<T> = OmitNever<RemoveIndexSignature<T>>;

/**
 * Extract SELECT type from schema (matches Kysely's Selectable<T> pattern)
 * @example type UserSelect = Selectable<typeof User>
 */
export type Selectable<
  T extends { readonly Selectable: Schema.Schema<unknown, unknown, unknown> },
> = StrictType<Schema.Schema.Type<T['Selectable']>>;

/**
 * Extract INSERT type from schema (matches Kysely's Insertable<T> pattern)
 * @example type UserInsert = Insertable<typeof User>
 */
export type Insertable<
  T extends { readonly Insertable: Schema.Schema<unknown, unknown, unknown> },
> = StrictType<Schema.Schema.Type<T['Insertable']>>;

/**
 * Extract UPDATE type from schema (matches Kysely's Updateable<T> pattern)
 * @example type UserUpdate = Updateable<typeof User>
 */
export type Updateable<
  T extends { readonly Updateable: Schema.Schema<unknown, unknown, unknown> },
> = StrictType<Schema.Schema.Type<T['Updateable']>>;

/**
 * Extract branded ID type from schema
 * @example type UserId = Id<typeof User>
 */
export type Id<T extends { Id: Schema.Schema<unknown, unknown, unknown> }> = Schema.Schema.Type<
  T['Id']
>;
