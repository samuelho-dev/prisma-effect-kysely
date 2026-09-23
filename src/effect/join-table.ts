import type { DMMF } from '@prisma/generator-helper';
import { getModelIdBrandModel, type JoinTableInfo } from '../prisma/relation.js';
import { toPascalCase, toSnakeCase } from '../utils/naming.js';

/**
 * Generate select and insert codecs for an implicit many-to-many table.
 */
export function generateJoinTableSchema(joinTable: JoinTableInfo, dmmf: DMMF.Document) {
  const { tableName, generatedName, modelA, modelB } = joinTable;
  const columnAFieldName = `${toSnakeCase(modelA)}_id`;
  const columnBFieldName = `${toSnakeCase(modelB)}_id`;
  const modelASchemaType = `${toPascalCase(resolveBrandModel(modelA, dmmf))}Id`;
  const modelBSchemaType = `${toPascalCase(resolveBrandModel(modelB, dmmf))}Id`;
  const fieldsName = `${generatedName}Fields`;
  const mapping = `{ ${JSON.stringify(columnAFieldName)}: "A", ${JSON.stringify(columnBFieldName)}: "B" }`;

  return `// ${tableName} Join Table (Prisma implicit many-to-many)
const ${fieldsName} = DatabaseSchema.Struct({
  ${columnAFieldName}: DatabaseSchema.Field({
    select: ${modelASchemaType},
    insert: ${modelASchemaType},
  }),
  ${columnBFieldName}: DatabaseSchema.Field({
    select: ${modelBSchemaType},
    insert: ${modelBSchemaType},
  }),
});

export const ${generatedName} = DatabaseSchema.extract(${fieldsName}, "select").pipe(
  Schema.encodeKeys(${mapping}),
);
export type ${generatedName} = typeof ${generatedName}.Type;

export const ${generatedName}Insert = DatabaseSchema.extract(${fieldsName}, "insert").pipe(
  Schema.encodeKeys(${mapping}),
);
export type ${generatedName}Insert = typeof ${generatedName}Insert.Type;`;
}
function resolveBrandModel(modelName: string, dmmf: DMMF.Document) {
  const model = dmmf.datamodel.models.find((candidate) => candidate.name === modelName);
  if (!model) {
    throw new Error(`Model ${modelName} not found`);
  }
  return getModelIdBrandModel(model, dmmf.datamodel.models)?.name ?? modelName;
}
