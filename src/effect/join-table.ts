import type { DMMF } from '@prisma/generator-helper';
import { getModelIdBrandModel, type JoinTableInfo } from '../prisma/relation.js';
import { toPascalCase, toSnakeCase } from '../utils/naming.js';

/**
 * Generate select and insert codecs for an implicit many-to-many table.
 */
export function generateJoinTableSchema(joinTable: JoinTableInfo, dmmf: DMMF.Document) {
  const { tableName, relationName, modelA, modelB } = joinTable;
  const columnAFieldName = `${toSnakeCase(modelA)}_id`;
  const columnBFieldName = `${toSnakeCase(modelB)}_id`;
  const modelASchemaType = `${toPascalCase(resolveBrandModel(modelA, dmmf))}Id`;
  const modelBSchemaType = `${toPascalCase(resolveBrandModel(modelB, dmmf))}Id`;
  const pascalName = toPascalCase(relationName);
  const fieldsName = `${pascalName}Fields`;
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

export const ${pascalName} = DatabaseSchema.extract(${fieldsName}, "select").pipe(
  Schema.encodeKeys(${mapping}),
);
export type ${pascalName} = typeof ${pascalName}.Type;

export const ${pascalName}Insert = DatabaseSchema.extract(${fieldsName}, "insert").pipe(
  Schema.encodeKeys(${mapping}),
);
export type ${pascalName}Insert = typeof ${pascalName}Insert.Type;`;
}
function resolveBrandModel(modelName: string, dmmf: DMMF.Document) {
  const model = dmmf.datamodel.models.find((candidate) => candidate.name === modelName);
  if (!model) {
    throw new Error(`Model ${modelName} not found`);
  }
  return getModelIdBrandModel(model, dmmf.datamodel.models)?.name ?? modelName;
}
