import * as AST from 'effect/SchemaAST';
import { Schema } from 'effect';
import type { Insertable, Selectable, Updateable } from 'kysely';

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
        return new AST.PropertySignature(
          prop.name,
          columnSchemas[schemaType].ast,
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
 * Create selectable schema from base schema
 */
export const selectable = <Type, Encoded>(schema: Schema.Schema<Type, Encoded>) => {
  const { ast } = schema;
  if (!AST.isTypeLiteral(ast)) {
    return Schema.asSchema(Schema.make(ast)) as Schema.Schema<
      Selectable<Type>,
      Selectable<Encoded>,
      never
    >;
  }
  return Schema.asSchema(
    Schema.make(
      new AST.TypeLiteral(
        extractParametersFromTypeLiteral(ast, 'selectSchema'),
        ast.indexSignatures,
        ast.annotations
      )
    )
  ) as Schema.Schema<Selectable<Type>, Selectable<Encoded>, never>;
};

/**
 * Create insertable schema from base schema
 * Filters out generated fields (@effect/sql Model.Generated pattern)
 */
export const insertable = <Type, Encoded>(schema: Schema.Schema<Type, Encoded>) => {
  const { ast } = schema;
  if (!AST.isTypeLiteral(ast)) {
    return Schema.asSchema(Schema.make(ast));
  }

  // Extract and filter out generated fields entirely
  const extracted = ast.propertySignatures
    .map((prop: AST.PropertySignature): AST.PropertySignature | null => {
      const columnSchemas = getColumnTypeSchemas(prop.type);
      if (columnSchemas !== null) {
        return new AST.PropertySignature(
          prop.name,
          columnSchemas.insertSchema.ast,
          prop.isOptional,
          prop.isReadonly,
          prop.annotations
        );
      }
      // For generated fields, mark them for filtering
      if (isGeneratedType(prop.type)) {
        return null; // Will be filtered out
      }
      return prop;
    })
    .filter((prop): prop is AST.PropertySignature => {
      // Filter out generated fields (null) and Never types
      return prop !== null && prop.type._tag !== 'NeverKeyword';
    })
    .map((prop): AST.PropertySignature => {
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

  const res = new AST.TypeLiteral(extracted, ast.indexSignatures, ast.annotations);
  return Schema.asSchema(Schema.make(res)) as Schema.Schema<
    Insertable<Type>,
    Insertable<Encoded>,
    never
  >;
};

/**
 * Create updateable schema from base schema
 */
export const updateable = <Type, Encoded>(schema: Schema.Schema<Type, Encoded>) => {
  const { ast } = schema;
  if (!AST.isTypeLiteral(ast)) {
    return Schema.asSchema(Schema.make(ast)) as Schema.Schema<
      Updateable<Type>,
      Updateable<Encoded>,
      never
    >;
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

  return Schema.asSchema(Schema.make(res)) as Schema.Schema<
    Updateable<Type>,
    Updateable<Encoded>,
    never
  >;
};

export interface Schemas<Type, Encoded> {
  Selectable: Schema.Schema<Selectable<Type>, Selectable<Encoded>>;
  Insertable: Schema.Schema<Insertable<Type>, Insertable<Encoded>>;
  Updateable: Schema.Schema<Updateable<Type>, Updateable<Encoded>>;
}

/**
 * Generate all operational schemas (Selectable/Insertable/Updateable) from base schema
 * Used in generated code
 */
export const getSchemas = <Type, Encoded>(baseSchema: Schema.Schema<Type, Encoded>) => ({
  Selectable: selectable(baseSchema),
  Insertable: insertable(baseSchema),
  Updateable: updateable(baseSchema),
});

export interface GetTypes<T extends Schemas<unknown, unknown>> {
  Selectable: Schema.Schema.Type<T['Selectable']>;
  Insertable: Schema.Schema.Type<T['Insertable']>;
  Updateable: Schema.Schema.Type<T['Updateable']>;
}
