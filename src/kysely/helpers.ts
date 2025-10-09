import * as AST from 'effect/SchemaAST';
import * as S from 'effect/Schema';
import {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from 'kysely';

/**
 * Runtime helpers for Kysely schema integration
 * These are imported by generated code
 */

export const ColumnTypeId = Symbol.for('/ColumnTypeId');
export const GeneratedId = Symbol.for('/GeneratedId');

interface ColumnTypeSchemas<
  SType,
  SEncoded,
  SR,
  IType,
  IEncoded,
  IR,
  UType,
  UEncoded,
  UR,
> {
  selectSchema: S.Schema<SType, SEncoded, SR>;
  insertSchema: S.Schema<IType, IEncoded, IR>;
  updateSchema: S.Schema<UType, UEncoded, UR>;
}

interface GeneratedSchemas<SType, SEncoded, R> {
  selectSchema: S.Schema<SType, SEncoded, R>;
  insertSchema: S.Schema<SType | undefined, SEncoded | undefined, R>;
  updateSchema: S.Schema<SType, SEncoded, R>;
}

/**
 * Mark a field as having different types for select/insert/update
 * Used for ID fields with @default (read-only)
 */
export const columnType = <
  SType,
  SEncoded,
  SR,
  IType,
  IEncoded,
  IR,
  UType,
  UEncoded,
  UR,
>(
  selectSchema: S.Schema<SType, SEncoded, SR>,
  insertSchema: S.Schema<IType, IEncoded, IR>,
  updateSchema: S.Schema<UType, UEncoded, UR>,
) => {
  const schemas: ColumnTypeSchemas<
    SType,
    SEncoded,
    SR,
    IType,
    IEncoded,
    IR,
    UType,
    UEncoded,
    UR
  > = {
    selectSchema,
    insertSchema,
    updateSchema,
  };
  return selectSchema.annotations({ [ColumnTypeId]: schemas });
};

/**
 * Mark a field as database-generated (optional on insert)
 * Used for fields with @default
 */
export const generated = <SType, SEncoded, R>(
  schema: S.Schema<SType, SEncoded, R>,
) => {
  const schemas: GeneratedSchemas<SType, SEncoded, R> = {
    selectSchema: schema,
    insertSchema: S.Union(schema, S.Undefined),
    updateSchema: schema,
  };
  return schema.annotations({ [GeneratedId]: schemas });
};

/**
 * Create selectable schema from base schema
 */
export const selectable = <Type, Encoded>(schema: S.Schema<Type, Encoded>) => {
  const { ast } = schema;
  if (!AST.isTypeLiteral(ast)) {
    return S.make(ast);
  }
  return S.make(
    new AST.TypeLiteral(
      extractParametersFromTypeLiteral(ast, 'selectSchema'),
      ast.indexSignatures,
      ast.annotations,
    ),
  );
};

/**
 * Create insertable schema from base schema
 */
export const insertable = <Type, Encoded>(schema: S.Schema<Type, Encoded>) => {
  const { ast } = schema;
  if (!AST.isTypeLiteral(ast)) {
    return S.make(ast);
  }

  const extracted = extractParametersFromTypeLiteral(ast, 'insertSchema');

  const res = new AST.TypeLiteral(
    extracted.map(
      (prop) =>
        new AST.PropertySignature(
          prop.name,
          prop.type,
          isOptionalType(prop.type),
          prop.isReadonly,
          prop.annotations,
        ),
    ),
    ast.indexSignatures,
    ast.annotations,
  );
  return S.make(res);
};

/**
 * Create updateable schema from base schema
 */
export const updateable = <Type, Encoded>(schema: S.Schema<Type, Encoded>) => {
  const { ast } = schema;
  if (!AST.isTypeLiteral(ast)) {
    return S.make(ast);
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
          prop.annotations,
        ),
    ),
    ast.indexSignatures,
    ast.annotations,
  );

  return S.make(res);
};

export interface Schemas<Type, Encoded> {
  Selectable: S.Schema<Selectable<Type>, Selectable<Encoded>>;
  Insertable: S.Schema<Insertable<Type>, Insertable<Encoded>>;
  Updateable: S.Schema<Updateable<Type>, Updateable<Encoded>>;
}

/**
 * Generate all operational schemas (Selectable/Insertable/Updateable) from base schema
 * Used in generated code
 */
export const getSchemas = <Type, Encoded>(
  baseSchema: S.Schema<Type, Encoded>,
) => ({
  Selectable: selectable(baseSchema),
  Insertable: insertable(baseSchema),
  Updateable: updateable(baseSchema),
});

export interface GetTypes<T extends Schemas<unknown, unknown>> {
  Selectable: S.Schema.Type<T['Selectable']>;
  Insertable: S.Schema.Type<T['Insertable']>;
  Updateable: S.Schema.Type<T['Updateable']>;
}

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

const extractParametersFromTypeLiteral = (
  ast: AST.TypeLiteral,
  schemaType: keyof AnyColumnTypeSchemas,
) => {
  return ast.propertySignatures
    .map((prop: AST.PropertySignature) => {
      if (isColumnType(prop.type)) {
        const schemas = prop.type.annotations[
          ColumnTypeId
        ] as AnyColumnTypeSchemas;
        return new AST.PropertySignature(
          prop.name,
          schemas[schemaType].ast,
          prop.isOptional,
          prop.isReadonly,
          prop.annotations,
        );
      }
      if (isGeneratedType(prop.type)) {
        const schemas = prop.type.annotations[GeneratedId] as GeneratedSchemas<
          unknown,
          unknown,
          unknown
        >;
        return new AST.PropertySignature(
          prop.name,
          schemas[schemaType].ast,
          prop.isOptional,
          prop.isReadonly,
          prop.annotations,
        );
      }
      return prop;
    })
    .filter((prop: AST.PropertySignature) => prop.type._tag !== 'NeverKeyword');
};

const isColumnType = (ast: AST.AST) => ColumnTypeId in ast.annotations;

const isGeneratedType = (ast: AST.AST) => GeneratedId in ast.annotations;

const isOptionalType = (ast: AST.AST) => {
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
    ([sym, value]) =>
      sym === AST.IdentifierAnnotationId.toString() && value === 'null',
  );
