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

interface ColumnTypeSchemas<SType, SEncoded, SR, IType, IEncoded, IR, UType, UEncoded, UR> {
  selectSchema: Schema.Schema<SType, SEncoded, SR>;
  insertSchema: Schema.Schema<IType, IEncoded, IR>;
  updateSchema: Schema.Schema<UType, UEncoded, UR>;
}

/**
 * Mark a field as having different types for select/insert/update
 * Used for ID fields with @default (read-only)
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
        // Use Schema.mutable() for insert/update schema to make arrays mutable
        // Kysely expects mutable T[] for insert/update operations
        const shouldBeMutable = schemaType === 'updateSchema' || schemaType === 'insertSchema';
        return new AST.PropertySignature(
          prop.name,
          shouldBeMutable
            ? Schema.mutable(columnSchemas[schemaType]).ast
            : columnSchemas[schemaType].ast,
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
    .filter((prop: AST.PropertySignature) => prop.type._tag !== 'NeverKeyword');
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

export interface Schemas<Type, Encoded> {
  Selectable: Schema.Schema<KyselySelectable<Type>, KyselySelectable<Encoded>, never>;
  Insertable: Schema.Schema<MutableInsert<Type>, MutableInsert<Encoded>, never>;
  Updateable: Schema.Schema<MutableUpdate<Type>, MutableUpdate<Encoded>, never>;
}

/**
 * Generate all operational schemas (Selectable/Insertable/Updateable) from base schema
 * Used in generated code
 */
export const getSchemas = <Type, Encoded>(
  baseSchema: Schema.Schema<Type, Encoded>
): Schemas<Type, Encoded> => ({
  Selectable: Selectable(baseSchema),
  Insertable: Insertable(baseSchema),
  Updateable: Updateable(baseSchema),
});

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
export type Selectable<T extends Schemas<unknown, unknown>> = StrictType<
  Schema.Schema.Type<T['Selectable']>
>;

/**
 * Extract INSERT type from schema (matches Kysely's Insertable<T> pattern)
 * @example type UserInsert = Insertable<typeof User>
 */
export type Insertable<T extends Schemas<unknown, unknown>> = StrictType<
  Schema.Schema.Type<T['Insertable']>
>;

/**
 * Extract UPDATE type from schema (matches Kysely's Updateable<T> pattern)
 * @example type UserUpdate = Updateable<typeof User>
 */
export type Updateable<T extends Schemas<unknown, unknown>> = StrictType<
  Schema.Schema.Type<T['Updateable']>
>;

/**
 * Extract branded ID type from schema
 * @example type UserId = Id<typeof User>
 */
export type Id<T extends { Id: Schema.Schema<unknown, unknown, unknown> }> = Schema.Schema.Type<
  T['Id']
>;
