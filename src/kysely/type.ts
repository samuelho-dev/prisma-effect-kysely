import type { DMMF } from '@prisma/generator-helper';
import type { JoinTableInfo } from '../prisma/relation.js';
import {
  filterSchemaFields,
  getFieldDbName,
  getFieldOperationConfig,
  getModelDbName,
  sortFields,
} from '../prisma/type.js';
import { toPascalCase, toSnakeCase } from '../utils/naming.js';

function generateModelTableInterface(model: DMMF.Model) {
  const modelName = toPascalCase(model.name);
  const fields = sortFields(filterSchemaFields(model.fields))
    .map((field) => {
      const columnName = JSON.stringify(getFieldDbName(field));
      const fieldName = JSON.stringify(field.name);
      const operation = getFieldOperationConfig(model, field);
      const updateType = operation.update
        ? `Exclude<typeof ${modelName}Update.Type[${fieldName}], undefined>`
        : 'never';

      return `  ${columnName}: ColumnType<
    typeof ${modelName}.Type[${fieldName}],
    typeof ${modelName}Insert.Type[${fieldName}],
    ${updateType}
  >;`;
    })
    .join('\n');

  return `export interface ${modelName}Table {
${fields}
}`;
}

function generateJoinTableInterface(joinTable: JoinTableInfo) {
  const name = joinTable.generatedName;
  const fields = (
    [
      ['A', `${toSnakeCase(joinTable.modelA)}_id`],
      ['B', `${toSnakeCase(joinTable.modelB)}_id`],
    ] as const
  )
    .map(
      ([columnName, fieldName]) => `  ${JSON.stringify(columnName)}: ColumnType<
    typeof ${name}.Type[${JSON.stringify(fieldName)}],
    typeof ${name}Insert.Type[${JSON.stringify(fieldName)}],
    never
  >;`
    )
    .join('\n');

  return `export interface ${name}Table {
${fields}
}`;
}

function getModelTableKey(model: DMMF.Model, tableNameCounts: ReadonlyMap<string, number>) {
  const tableName = getModelDbName(model);
  return tableNameCounts.get(tableName)! > 1 && model.schema
    ? `${model.schema}.${tableName}`
    : tableName;
}

/**
 * Generate named native Kysely table interfaces followed by the DB map.
 */
export function generateDBInterface(
  models: readonly DMMF.Model[],
  joinTables: JoinTableInfo[] = []
) {
  const tableNameCounts = new Map<string, number>();
  for (const model of models) {
    const tableName = getModelDbName(model);
    tableNameCounts.set(tableName, (tableNameCounts.get(tableName) ?? 0) + 1);
  }
  const tableInterfaces = [
    ...Array.from(models, generateModelTableInterface),
    ...joinTables.map(generateJoinTableInterface),
  ].join('\n\n');
  const dbEntries = [
    ...Array.from(
      models,
      (model) =>
        `  ${JSON.stringify(getModelTableKey(model, tableNameCounts))}: ${toPascalCase(model.name)}Table;`
    ),
    ...joinTables.map(
      (joinTable) => `  ${JSON.stringify(joinTable.tableName)}: ${joinTable.generatedName}Table;`
    ),
  ].join('\n');

  return `${tableInterfaces}${tableInterfaces ? '\n\n' : ''}// Kysely Database Interface
export interface DB {
${dbEntries}
}`;
}
