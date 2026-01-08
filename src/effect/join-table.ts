import type { DMMF } from '@prisma/generator-helper';
import type { JoinTableInfo } from '../prisma/relation.js';
import { toSnakeCase } from '../utils/naming.js';

/**
 * Generate Kysely table interface for a join table
 */
export function generateJoinTableKyselyInterface(joinTable: JoinTableInfo) {
  const { relationName, modelA, modelB, columnAIsUuid, columnBIsUuid } = joinTable;

  const modelAField = toSnakeCase(modelA);
  const modelBField = toSnakeCase(modelB);

  const aType = columnAIsUuid ? 'string' : 'number';
  const bType = columnBIsUuid ? 'string' : 'number';

  return `// Kysely table interface for ${relationName} (internal)
interface ${relationName}Table {
  ${modelAField}: ColumnType<${aType}, never, never>;
  ${modelBField}: ColumnType<${bType}, never, never>;
}`;
}

/**
 * Map join table column type to Effect Schema type
 * Uses same mapping as regular fields
 */
function mapColumnType(columnType: string, isUuid: boolean) {
  if (columnType === 'String' && isUuid) {
    return 'Schema.UUID';
  }

  const scalarMap: Record<string, string> = {
    String: 'Schema.String',
    Int: 'Schema.Number',
    BigInt: 'Schema.BigInt',
  };

  return scalarMap[columnType] || 'Schema.Unknown';
}

/**
 * Generate Effect Schema for an implicit many-to-many join table
 *
 * Structure:
 * - Base schema with semantic snake_case field names mapped to A/B via fromKey
 * - Operational schemas via getSchemas()
 * - No type exports - consumers use type utilities: Selectable<typeof JoinTable>
 *
 * Example:
 * - Database columns: A, B (Prisma requirement)
 * - TypeScript fields: product_id, product_tag_id (semantic snake_case)
 * - Mapping: product_id → A, product_tag_id → B (via Schema.fromKey)
 */
export function generateJoinTableSchema(joinTable: JoinTableInfo, _dmmf: DMMF.Document) {
  const {
    tableName,
    relationName,
    modelA,
    modelB,
    columnAType,
    columnBType,
    columnAIsUuid,
    columnBIsUuid,
  } = joinTable;

  // Map column types to Effect Schema types
  const columnASchema = mapColumnType(columnAType, columnAIsUuid);
  const columnBSchema = mapColumnType(columnBType, columnBIsUuid);

  // Generate semantic snake_case field names from model names
  const columnAName = `${toSnakeCase(modelA)}_id`;
  const columnBName = `${toSnakeCase(modelB)}_id`;

  // Both columns are foreign keys, so use columnType for read-only behavior
  // Use propertySignature with fromKey to map semantic names to actual A/B database columns
  const columnAField = `  ${columnAName}: Schema.propertySignature(columnType(${columnASchema}, Schema.Never, Schema.Never)).pipe(Schema.fromKey("A"))`;
  const columnBField = `  ${columnBName}: Schema.propertySignature(columnType(${columnBSchema}, Schema.Never, Schema.Never)).pipe(Schema.fromKey("B"))`;

  // Generate base schema (internal)
  const baseSchema = `// ${tableName} Join Table Schema (internal)
// Database columns: A (${modelA}), B (${modelB})
// TypeScript fields: ${columnAName}, ${columnBName}
const _${relationName} = Schema.Struct({
${columnAField},
${columnBField},
});`;

  // Generate operational schemas (no Id for join tables - they use composite keys)
  const operationalSchema = `export const ${relationName} = getSchemas(_${relationName});`;

  // No type exports - consumers use: Selectable<typeof JoinTable>
  return `${baseSchema}\n\n${operationalSchema}`;
}
