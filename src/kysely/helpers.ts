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
 */

export const ColumnTypeId = Symbol.for('/ColumnTypeId');
export const GeneratedId = Symbol.for('/GeneratedId');

// Note: Previous versions used phantom types with intersection types for compile-time
// field exclusion, but this approach breaks Schema compatibility when skipLibCheck: false.
// The current approach trusts runtime schema construction which correctly excludes fields.

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
 */
export const columnType = <SType, SEncoded, SR, IType, IEncoded, IR, UType, UEncoded, UR>(
  selectSchema: Schema.Schema<SType, SEncoded, SR>,
  insertSchema: Schema.Schema<IType, IEncoded, IR>,
  updateSchema: Schema.Schema<UType, UEncoded, UR>
): Schema.Schema<SType, SEncoded, SR> => {
  const schemas: ColumnTypeSchemas<SType, SEncoded, SR, IType, IEncoded, IR, UType, UEncoded, UR> =
    {
      selectSchema,
      insertSchema,
      updateSchema,
    };
  return Schema.asSchema(selectSchema.annotations({ [ColumnTypeId]: schemas }));
};

/**
 * Mark a field as database-generated (omitted from insert)
 * Used for fields with @default
 *
 * Follows @effect/sql Model.Generated pattern:
 * - Present in select and update schemas
 * - OMITTED from insert schema (not optional, completely absent)
 */
export const generated = <SType, SEncoded, R>(
  schema: Schema.Schema<SType, SEncoded, R>
): Schema.Schema<SType, SEncoded, R> => {
  return Schema.asSchema(schema.annotations({ [GeneratedId]: true }));
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
// Schema Functions
// ============================================================================

/**
 * Create Selectable schema from base schema
 */
type MutableInsert<Type> = DeepMutable<KyselyInsertable<Type>>;
type MutableUpdate<Type> = DeepMutable<KyselyUpdateable<Type>>;

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
 * Uses Schema.Schema.Any constraint to support schemas with phantom types
 * (columnType, generated) that use intersection types internally.
 */
export interface Schemas<BaseSchema extends Schema.Schema.Any> {
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
  BaseSchema extends Schema.Schema.Any,
  IdSchema extends Schema.Schema.Any,
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
  BaseSchema extends Schema.Schema.Any,
  IdSchema extends Schema.Schema.Any,
>(baseSchema: BaseSchema, idSchema: IdSchema): SchemasWithId<BaseSchema, IdSchema>;

export function getSchemas<BaseSchema extends Schema.Schema.Any>(
  baseSchema: BaseSchema
): Schemas<BaseSchema>;

export function getSchemas<
  BaseSchema extends Schema.Schema.Any,
  IdSchema extends Schema.Schema.Any,
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

type StrictType<T> = RemoveIndexSignature<T>;

/**
 * Extract SELECT type from schema (matches Kysely's Selectable<T> pattern)
 * @example type UserSelect = Selectable<typeof User>
 */
export type Selectable<T extends { readonly Selectable: Schema.Schema.Any }> = StrictType<
  Schema.Schema.Type<T['Selectable']>
>;

/**
 * Extract INSERT type from schema (matches Kysely's Insertable<T> pattern)
 * Excludes fields with never insert type (e.g., columnType(T, Schema.Never, ...))
 * and generated fields (marked with generated()).
 *
 * Note: This extracts types from the pre-computed Insertable schema which already
 * correctly excludes generated fields at runtime. This avoids phantom type issues
 * with unique symbols that don't maintain identity across module boundaries.
 *
 * @example type UserInsert = Insertable<typeof User>
 */
export type Insertable<T extends { readonly Insertable: Schema.Schema.Any }> = StrictType<
  Schema.Schema.Type<T['Insertable']>
>;

/**
 * Extract UPDATE type from schema (matches Kysely's Updateable<T> pattern)
 * Excludes fields with never update type (e.g., columnType(T, ..., Schema.Never))
 *
 * Note: This extracts types from the pre-computed Updateable schema which already
 * correctly handles field transformations at runtime.
 *
 * @example type UserUpdate = Updateable<typeof User>
 */
export type Updateable<T extends { readonly Updateable: Schema.Schema.Any }> = StrictType<
  Schema.Schema.Type<T['Updateable']>
>;

/**
 * Extract branded ID type from schema
 * @example type UserId = Id<typeof User>
 */
export type Id<T extends { Id: Schema.Schema.Any }> = Schema.Schema.Type<T['Id']>;
