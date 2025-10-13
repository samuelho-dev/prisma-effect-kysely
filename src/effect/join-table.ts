import type { DMMF } from '@prisma/generator-helper';
import type { JoinTableInfo } from '../prisma/relation';
import { toSnakeCase } from '../utils/naming';

/**
 * Map join table column type to Effect Schema type
 * Uses same mapping as regular fields
 */
function mapColumnType(columnType: string, isUuid: boolean): string {
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
 * - Type exports (Select, Insert, Update)
 * - Encoded type exports
 *
 * Example:
 * - Database columns: A, B (Prisma requirement)
 * - TypeScript fields: product_id, product_tag_id (semantic snake_case)
 * - Mapping: product_id → A, product_tag_id → B (via Schema.fromKey)
 */
export function generateJoinTableSchema(joinTable: JoinTableInfo, _dmmf: DMMF.Document): string {
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

  // Generate base schema
  const baseSchema = `// ${tableName} Join Table Schema
// Database columns: A (${modelA}), B (${modelB})
// TypeScript fields: ${columnAName}, ${columnBName}
export const _${relationName} = Schema.Struct({
${columnAField},
${columnBField},
});`;

  // Generate operational schemas
  const operationalSchema = `export const ${relationName} = getSchemas(_${relationName});`;

  // Generate Type exports
  const typeExports = `export type ${relationName}Select = Schema.Schema.Type<typeof ${relationName}.Selectable>;
export type ${relationName}Insert = Schema.Schema.Type<typeof ${relationName}.Insertable>;
export type ${relationName}Update = Schema.Schema.Type<typeof ${relationName}.Updateable>;`;

  // Generate Encoded type exports
  const encodedExports = `export type ${relationName}SelectEncoded = Schema.Schema.Encoded<typeof ${relationName}.Selectable>;
export type ${relationName}InsertEncoded = Schema.Schema.Encoded<typeof ${relationName}.Insertable>;
export type ${relationName}UpdateEncoded = Schema.Schema.Encoded<typeof ${relationName}.Updateable>;`;

  return `${baseSchema}\n\n${operationalSchema}\n\n${typeExports}\n${encodedExports}`;
}
