import type { DMMF } from '@prisma/generator-helper';
import type { JoinTableInfo } from '../prisma/relation.js';
import {
  filterSchemaFields,
  getFieldDbName,
  getFieldOperationConfig,
  getModelDbName,
  sortFields,
} from '../prisma/type.js';
import { toPascalCase } from '../utils/naming.js';

function generateModelTableInterface(model: DMMF.Model) {
  const modelName = toPascalCase(model.name);
  const fields = sortFields(filterSchemaFields(model.fields))
    .map((field) => {
      const columnName = JSON.stringify(getFieldDbName(field));
      const operation = getFieldOperationConfig(model, field);
      const updateType = operation.update
        ? `Exclude<Schema.Codec.Encoded<typeof ${modelName}Update>[${columnName}], undefined>`
        : 'never';

      return `  ${columnName}: ColumnType<
    Schema.Codec.Encoded<typeof ${modelName}>[${columnName}],
    Schema.Codec.Encoded<typeof ${modelName}Insert>[${columnName}],
    ${updateType}
  >;`;
    })
    .join('\n');

  return `export interface ${modelName}Table {
${fields}
}`;
}

function generateJoinTableInterface(joinTable: JoinTableInfo) {
  const name = toPascalCase(joinTable.relationName);
  const fields = ['A', 'B']
    .map(
      (columnName) => `  "${columnName}": ColumnType<
    Schema.Codec.Encoded<typeof ${name}>["${columnName}"],
    Schema.Codec.Encoded<typeof ${name}Insert>["${columnName}"],
    never
  >;`
    )
    .join('\n');

  return `export interface ${name}Table {
${fields}
}`;
}

/**
 * Generate named native Kysely table interfaces followed by the DB map.
 */
export function generateDBInterface(
  models: readonly DMMF.Model[],
  joinTables: JoinTableInfo[] = []
) {
  const tableInterfaces = [
    ...Array.from(models, generateModelTableInterface),
    ...joinTables.map(generateJoinTableInterface),
  ].join('\n\n');
  const dbEntries = [
    ...Array.from(
      models,
      (model) => `  ${JSON.stringify(getModelDbName(model))}: ${toPascalCase(model.name)}Table;`
    ),
    ...joinTables.map(
      (joinTable) =>
        `  ${JSON.stringify(joinTable.tableName)}: ${toPascalCase(joinTable.relationName)}Table;`
    ),
  ].join('\n');

  return `${tableInterfaces}${tableInterfaces ? '\n\n' : ''}// Kysely Database Interface
export interface DB {
${dbEntries}
}`;
}
