import type { DMMF } from "@prisma/generator-helper";
import type { JoinTableInfo } from "../prisma/relation";

/**
 * Map join table column type to Effect Schema type
 * Uses same mapping as regular fields
 */
function mapColumnType(
  columnType: string,
  isUuid: boolean,
): string {
  if (columnType === "String" && isUuid) {
    return "Schema.UUID";
  }

  const scalarMap: Record<string, string> = {
    String: "Schema.String",
    Int: "Schema.Number",
    BigInt: "Schema.BigInt",
  };

  return scalarMap[columnType] || "Schema.Unknown";
}

/**
 * Generate Effect Schema for an implicit many-to-many join table
 *
 * Structure:
 * - Base schema with A and B columns (both read-only FKs via columnType)
 * - Operational schemas via getSchemas()
 * - Type exports (Select, Insert, Update)
 * - Encoded type exports
 */
export function generateJoinTableSchema(
  joinTable: JoinTableInfo,
  dmmf: DMMF.Document,
): string {
  const { tableName, relationName, columnAType, columnBType, columnAIsUuid, columnBIsUuid } = joinTable;

  // Map column types to Effect Schema types
  const columnASchema = mapColumnType(columnAType, columnAIsUuid);
  const columnBSchema = mapColumnType(columnBType, columnBIsUuid);

  // Both columns are foreign keys, so use columnType for read-only behavior
  const columnAField = `  A: columnType(${columnASchema}, Schema.Never, Schema.Never)`;
  const columnBField = `  B: columnType(${columnBSchema}, Schema.Never, Schema.Never)`;

  // Generate base schema
  const baseSchema = `// ${tableName} Join Table Schema
export const _${relationName} = Schema.Struct({
${columnAField},
${columnBField},
});`;

  // Generate operational schemas as namespace
  const operationalSchema = `export namespace ${relationName} {
  const schemas = getSchemas(_${relationName});
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}`;

  // Generate Type exports as namespace
  const typeExports = `export namespace ${relationName} {
  export type Select = Schema.Schema.Type<typeof ${relationName}.Selectable>;
  export type Insert = Schema.Schema.Type<typeof ${relationName}.Insertable>;
  export type Update = Schema.Schema.Type<typeof ${relationName}.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof ${relationName}.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof ${relationName}.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof ${relationName}.Updateable>;
}`;

  return `${baseSchema}\n\n${operationalSchema}\n\n${typeExports}`;
}
