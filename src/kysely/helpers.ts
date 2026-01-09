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

// Phantom type symbols for compile-time type propagation
declare const ColumnTypeInsertPhantom: unique symbol;
declare const ColumnTypeUpdatePhantom: unique symbol;

/**
 * A schema with phantom types encoding insert/update type constraints.
 * This allows TypeScript to know at compile time which fields have
 * `never` insert/update types and should be excluded.
 */
export type ColumnTypeSchema<SType, SEncoded, SR, IType, UType> = Schema.Schema<
  SType,
  SEncoded,
  SR
> & {
  readonly [ColumnTypeInsertPhantom]: IType;
  readonly [ColumnTypeUpdatePhantom]: UType;
};

// Type guards for extracting phantom types
type ExtractInsertPhantom<T> = T extends { readonly [ColumnTypeInsertPhantom]: infer I }
  ? I
  : T extends Schema.Schema<infer S, unknown, unknown>
    ? S
    : never;

type ExtractUpdatePhantom<T> = T extends { readonly [ColumnTypeUpdatePhantom]: infer U }
  ? U
  : T extends Schema.Schema<infer S, unknown, unknown>
    ? S
    : never;

interface ColumnTypeSchemas<SType, SEncoded, SR, IType, IEncoded, IR, UType, UEncoded, UR> {
  selectSchema: Schema.Schema<SType, SEncoded, SR>;
  insertSchema: Schema.Schema<IType, IEncoded, IR>;
  updateSchema: Schema.Schema<UType, UEncoded, UR>;
}

/**
 * Mark a field as having different types for select/insert/update
 * Used for ID fields with @default (read-only)
 *
 * Returns a schema with phantom types so TypeScript knows at compile time
 * which fields should be excluded from insert/update operations.
 */
export const columnType = <SType, SEncoded, SR, IType, IEncoded, IR, UType, UEncoded, UR>(
  selectSchema: Schema.Schema<SType, SEncoded, SR>,
  insertSchema: Schema.Schema<IType, IEncoded, IR>,
  updateSchema: Schema.Schema<UType, UEncoded, UR>
): ColumnTypeSchema<SType, SEncoded, SR, IType, UType> => {
  const schemas: ColumnTypeSchemas<SType, SEncoded, SR, IType, IEncoded, IR, UType, UEncoded, UR> =
    {
      selectSchema,
      insertSchema,
      updateSchema,
    };
  return Schema.asSchema(selectSchema.annotations({ [ColumnTypeId]: schemas })) as ColumnTypeSchema<
    SType,
    SEncoded,
    SR,
    IType,
    UType
  >;
};

/**
 * Mark a field as database-generated (omitted from insert)
 * Used for fields with @default
 *
 * Follows @effect/sql Model.Generated pattern:
 * - Present in select and update schemas
 * - OMITTED from insert schema (not optional, completely absent)
 */
export const generated = <SType, SEncoded, R>(schema: Schema.Schema<SType, SEncoded, R>) => {
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
 */
export interface Schemas<
  Type,
  Encoded,
  BaseSchema extends Schema.Schema<Type, Encoded> = Schema.Schema<Type, Encoded>,
> {
  readonly _base: BaseSchema;
  readonly Selectable: Schema.Schema<KyselySelectable<Type>, KyselySelectable<Encoded>, never>;
  readonly Insertable: Schema.Schema<MutableInsert<Type>, MutableInsert<Encoded>, never>;
  readonly Updateable: Schema.Schema<MutableUpdate<Type>, MutableUpdate<Encoded>, never>;
}

/**
 * Extended Schemas interface with branded Id type.
 * Returned when getSchemas() is called with an idSchema parameter.
 */
export interface SchemasWithId<
  Type,
  Encoded,
  BaseSchema extends Schema.Schema<Type, Encoded>,
  IdSchema extends Schema.Schema<unknown, unknown, unknown>,
> extends Schemas<Type, Encoded, BaseSchema> {
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
  Type,
  Encoded,
  BaseSchema extends Schema.Schema<Type, Encoded>,
  IdSchema extends Schema.Schema<unknown, unknown, unknown>,
>(baseSchema: BaseSchema, idSchema: IdSchema): SchemasWithId<Type, Encoded, BaseSchema, IdSchema>;

export function getSchemas<Type, Encoded, BaseSchema extends Schema.Schema<Type, Encoded>>(
  baseSchema: BaseSchema
): Schemas<Type, Encoded, BaseSchema>;

export function getSchemas<
  Type,
  Encoded,
  BaseSchema extends Schema.Schema<Type, Encoded>,
  IdSchema extends Schema.Schema<unknown, unknown, unknown>,
>(
  baseSchema: BaseSchema,
  idSchema?: IdSchema
): Schemas<Type, Encoded, BaseSchema> | SchemasWithId<Type, Encoded, BaseSchema, IdSchema> {
  const base: Schemas<Type, Encoded, BaseSchema> = {
    _base: baseSchema,
    Selectable: Selectable(baseSchema),
    Insertable: Insertable(baseSchema),
    Updateable: Updateable(baseSchema),
  };

  if (idSchema) {
    return { ...base, Id: idSchema } as SchemasWithId<Type, Encoded, BaseSchema, IdSchema>;
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

// Extract struct fields from base schema
type ExtractStructFields<T> = T extends { readonly _base: Schema.Struct<infer F> } ? F : never;

// Check if a field has never insert phantom type
type HasNeverInsert<T> = T extends { readonly [ColumnTypeInsertPhantom]: never } ? true : false;

// Check if a field has never update phantom type
type HasNeverUpdate<T> = T extends { readonly [ColumnTypeUpdatePhantom]: never } ? true : false;

// Filter out fields with never insert type
type InsertableFields<Fields> = {
  [K in keyof Fields as HasNeverInsert<Fields[K]> extends true ? never : K]: Fields[K];
};

// Filter out fields with never update type
type UpdateableFields<Fields> = {
  [K in keyof Fields as HasNeverUpdate<Fields[K]> extends true ? never : K]: Fields[K];
};

// Compute insertable type from struct fields
type ComputeInsertableType<Fields> = StrictType<{
  [K in keyof InsertableFields<Fields>]: ExtractInsertPhantom<Fields[K]>;
}>;

// Compute updateable type from struct fields (all fields optional)
type ComputeUpdateableType<Fields> = StrictType<{
  [K in keyof UpdateableFields<Fields>]?: ExtractUpdatePhantom<Fields[K]>;
}>;

/**
 * Extract SELECT type from schema (matches Kysely's Selectable<T> pattern)
 * @example type UserSelect = Selectable<typeof User>
 */
export type Selectable<
  T extends { readonly Selectable: Schema.Schema<unknown, unknown, unknown> },
> = StrictType<Schema.Schema.Type<T['Selectable']>>;

/**
 * Extract INSERT type from schema (matches Kysely's Insertable<T> pattern)
 * Excludes fields with never insert type (e.g., columnType(T, Schema.Never, ...))
 * @example type UserInsert = Insertable<typeof User>
 */
export type Insertable<
  T extends {
    readonly _base: Schema.Schema<unknown, unknown, unknown>;
    readonly Insertable: Schema.Schema<unknown, unknown, unknown>;
  },
> =
  ExtractStructFields<T> extends infer F
    ? [F] extends [never]
      ? StrictType<Schema.Schema.Type<T['Insertable']>>
      : ComputeInsertableType<F>
    : never;

/**
 * Extract UPDATE type from schema (matches Kysely's Updateable<T> pattern)
 * Excludes fields with never update type (e.g., columnType(T, ..., Schema.Never))
 * @example type UserUpdate = Updateable<typeof User>
 */
export type Updateable<
  T extends {
    readonly _base: Schema.Schema<unknown, unknown, unknown>;
    readonly Updateable: Schema.Schema<unknown, unknown, unknown>;
  },
> =
  ExtractStructFields<T> extends infer F
    ? [F] extends [never]
      ? StrictType<Schema.Schema.Type<T['Updateable']>>
      : ComputeUpdateableType<F>
    : never;

/**
 * Extract branded ID type from schema
 * @example type UserId = Id<typeof User>
 */
export type Id<T extends { Id: Schema.Schema<unknown, unknown, unknown> }> = Schema.Schema.Type<
  T['Id']
>;
