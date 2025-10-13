import type { DMMF } from '@prisma/generator-helper';
import { hasDefaultValue, isIdField, getFieldDbName } from '../prisma/type';
import type { JoinTableInfo } from '../prisma/relation';
import { toPascalCase } from '../utils/naming';

/**
 * Determine if field needs Kysely columnType wrapper
 * ID fields with @default are read-only (can't insert/update)
 */
export function needsColumnType(field: DMMF.Field) {
  return hasDefaultValue(field) && isIdField(field);
}

/**
 * Determine if field needs Kysely generated wrapper
 * Regular fields with @default are optional on insert
 */
export function needsGenerated(field: DMMF.Field) {
  return hasDefaultValue(field) && !isIdField(field);
}

/**
 * Apply Kysely helper wrappers to a field type
 */
export function applyKyselyHelpers(fieldType: string, field: DMMF.Field) {
  if (needsColumnType(field)) {
    return `columnType(${fieldType}, Schema.Never, Schema.Never)`;
  } else if (needsGenerated(field)) {
    return `generated(${fieldType})`;
  }
  return fieldType;
}

/**
 * Apply @map directive wrapper if field has different DB name
 */
export function applyMapDirective(fieldType: string, field: DMMF.Field) {
  const dbName = getFieldDbName(field);
  if (field.dbName && field.dbName !== field.name) {
    return `Schema.propertySignature(${fieldType}).pipe(Schema.fromKey("${dbName}"))`;
  }
  return fieldType;
}

/**
 * Build complete field type with Kysely helpers and @map
 * Order: base type � Kysely helpers � @map wrapper
 */
export function buildKyselyFieldType(baseFieldType: string, field: DMMF.Field) {
  // Step 1: Apply Kysely helpers (domain transformation)
  let fieldType = applyKyselyHelpers(baseFieldType, field);

  // Step 2: Apply @map wrapper (structural transformation)
  fieldType = applyMapDirective(fieldType, field);

  return fieldType;
}

/**
 * Generate DB interface entry for a model
 * Uses pre-resolved *SelectEncoded type for Kysely compatibility
 */
export function generateDBInterfaceEntry(model: DMMF.Model) {
  const tableName = model.dbName || model.name;
  const pascalName = toPascalCase(model.name);
  return `  ${tableName}: ${pascalName}SelectEncoded;`;
}

/**
 * Generate DB interface entry for a join table
 * Uses pre-resolved *SelectEncoded type for Kysely compatibility
 */
export function generateJoinTableDBInterfaceEntry(joinTable: JoinTableInfo) {
  const { tableName, relationName } = joinTable;
  return `  ${tableName}: ${relationName}SelectEncoded;`;
}

/**
 * Generate complete DB interface including join tables
 */
export function generateDBInterface(
  models: readonly DMMF.Model[],
  joinTables: JoinTableInfo[] = []
) {
  const modelEntries = Array.from(models).map(generateDBInterfaceEntry).join('\n');

  const joinTableEntries =
    joinTables.length > 0
      ? '\n' + joinTables.map(generateJoinTableDBInterfaceEntry).join('\n')
      : '';

  return `// Kysely Database Interface
export interface DB {
${modelEntries}${joinTableEntries}
}`;
}
