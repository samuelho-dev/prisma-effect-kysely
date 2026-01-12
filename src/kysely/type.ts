import type { DMMF } from '@prisma/generator-helper';
import type { JoinTableInfo } from '../prisma/relation.js';
import { getFieldDbName, hasDefaultValue, isIdField, isUuidField } from '../prisma/type.js';
import { toEnumSchemaName, toPascalCase } from '../utils/naming.js';

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
 * Determine if field should be omitted from Insert type
 * ID fields with @default are read-only (database generates them)
 * Also includes non-ID fields with @default that use columnType with Schema.Never for insert
 */
export function needsOmitFromInsert(field: DMMF.Field) {
  // ID fields with any @default (uuid, dbgenerated, autoincrement, etc.)
  // These use columnType(..., Schema.Never, Schema.Never) and must be omitted
  if (isIdField(field) && hasDefaultValue(field)) {
    return true;
  }
  // Non-ID fields with @default that need to be omitted from insert
  return needsGenerated(field);
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
 * Map Prisma scalar types to plain TypeScript types (for Kysely)
 * For enums, uses Schema.Schema.Type extraction to get the type from the imported Schema
 */
export function mapPrismaTypeToTS(field: DMMF.Field, _dmmf: DMMF.Document) {
  let baseType: string;

  // Handle enums - use Schema type extraction since we only import Schema wrappers
  if (field.kind === 'enum') {
    const schemaName = toEnumSchemaName(field.type);
    baseType = `Schema.Schema.Type<typeof ${schemaName}>`;
  }
  // UUID detection
  else if (isUuidField(field)) {
    baseType = 'string'; // Kysely uses string for UUIDs
  }
  // Standard Prisma → TS mappings
  else {
    const typeMap: Record<string, string> = {
      String: 'string',
      Int: 'number',
      Float: 'number',
      Boolean: 'boolean',
      DateTime: 'Date',
      Json: 'unknown',
      Bytes: 'Buffer',
      Decimal: 'string',
      BigInt: 'string', // Kysely convention
    };

    baseType = typeMap[field.type] || field.type;
  }

  // Apply array wrapping for ALL types (including enums)
  return field.isList ? `Array<${baseType}>` : baseType;
}

/**
 * Generate ColumnType wrapper for a field based on Prisma metadata
 * Returns parameters for ColumnType<SelectType, InsertType, UpdateType>
 */
export function generateColumnTypeWrapper(field: DMMF.Field, baseType: string) {
  // Read-only fields (ID with @default)
  if (hasDefaultValue(field) && isIdField(field)) {
    return 'never, never'; // ColumnType<T, never, never>
  }

  // Generated fields (@default, @updatedAt)
  if (hasDefaultValue(field) || field.isUpdatedAt) {
    return `${baseType} | undefined, ${baseType} | undefined`; // ColumnType<T, T?, T?>
  }

  return null; // Plain type, no wrapper needed
}

/**
 * Generate field type for Kysely table interface
 */
export function generateKyselyFieldType(field: DMMF.Field, dmmf: DMMF.Document) {
  const baseType = mapPrismaTypeToTS(field, dmmf);

  const columnTypeParams = generateColumnTypeWrapper(field, baseType);
  if (columnTypeParams) {
    const [insertType, updateType] = columnTypeParams.split(', ');
    return `ColumnType<${baseType}, ${insertType}, ${updateType}>`;
  }

  // Optional fields
  if (!field.isRequired) {
    return `${baseType} | null`;
  }

  return baseType;
}

/**
 * Generate Kysely table interface for a model
 * Exported so consumers can use Kysely's native type utilities:
 * - Selectable<UserTable> - all fields
 * - Insertable<UserTable> - excludes ColumnType<S, never, U> fields
 * - Updateable<UserTable> - excludes ColumnType<S, I, never> fields
 */
export function generateKyselyTableInterface(
  model: DMMF.Model,
  fields: readonly DMMF.Field[],
  dmmf: DMMF.Document
): string {
  const tableName = `${toPascalCase(model.name)}Table`;

  const fieldDefs = fields
    .map((field) => {
      const fieldType = generateKyselyFieldType(field, dmmf);
      return `  ${field.name}: ${fieldType};`;
    })
    .join('\n');

  return `// Kysely table interface for ${model.name}
// Use with Kysely type utilities: Selectable<${tableName}>, Insertable<${tableName}>, Updateable<${tableName}>
export interface ${tableName} {
${fieldDefs}
}`;
}

/**
 * Generate DB interface entry for a model
 * Uses Kysely table interface for native compatibility
 */
export function generateDBInterfaceEntry(model: DMMF.Model) {
  const tableName = model.dbName || model.name;
  const pascalName = toPascalCase(model.name);
  return `  ${tableName}: ${pascalName}Table;`;
}

/**
 * Generate DB interface entry for a join table
 * Uses Kysely table interface for native compatibility
 */
export function generateJoinTableDBInterfaceEntry(joinTable: JoinTableInfo) {
  const { tableName, relationName } = joinTable;
  return `  ${tableName}: ${relationName}Table;`;
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
      ? `\n${joinTables.map(generateJoinTableDBInterfaceEntry).join('\n')}`
      : '';

  return `// Kysely Database Interface
export interface DB {
${modelEntries}${joinTableEntries}
}`;
}
