import type { DMMF } from '@prisma/generator-helper';
import { hasDefaultValue, isListField, isRequiredField, isUuidField } from '../prisma/type.js';
import { extractEffectTypeOverride } from '../utils/annotations.js';
import { toPascalCase } from '../utils/naming.js';

/**
 * Prisma scalar type mapping to Effect Schema types
 * Uses const assertion to avoid type guards
 *
 * Note: DateTime uses Schema.DateFromSelf (not Schema.Date) so that:
 * - Type = Date (runtime)
 * - Encoded = Date (database)
 * This allows Kysely to work with native Date objects directly.
 * Schema.Date would encode to string, requiring ISO string conversions.
 */
const PRISMA_SCALAR_MAP = {
  String: 'Schema.String',
  Int: 'Schema.Number',
  Float: 'Schema.Number',
  BigInt: 'Schema.BigInt',
  Decimal: 'Schema.String', // For precision
  Boolean: 'Schema.Boolean',
  DateTime: 'Schema.DateFromSelf', // Native Date type for Kysely compatibility
  Json: 'Schema.Unknown', // Safe unknown type
  Bytes: 'Schema.Uint8Array',
} as const;

/**
 * Map Prisma field type to Effect Schema type
 * Priority order: annotation → UUID → scalar → enum → unknown fallback
 */
export function mapFieldToEffectType(field: DMMF.Field, dmmf: DMMF.Document) {
  // PRIORITY 1: Check for @customType annotation
  const typeOverride = extractEffectTypeOverride(field);
  if (typeOverride) {
    return typeOverride;
  }

  // PRIORITY 2: Handle String type with UUID detection
  if (field.type === 'String' && isUuidField(field)) {
    return 'Schema.UUID';
  }

  // PRIORITY 3: Handle scalar types with const assertion lookup
  const scalarType = PRISMA_SCALAR_MAP[field.type as keyof typeof PRISMA_SCALAR_MAP];
  if (scalarType) {
    return scalarType;
  }

  // PRIORITY 4: Check if it's an enum
  // TDD: Satisfies tests 11-12 in field-type-generation.test.ts
  const enumDef = dmmf.datamodel.enums.find((e) => e.name === field.type);
  if (enumDef) {
    // Return Schema wrapper, not raw enum (Test 11)
    // Use PascalCase + Schema suffix (Test 12)
    return toPascalCase(field.type, 'Schema');
  }

  // PRIORITY 5: Fallback to Unknown
  return 'Schema.Unknown';
}

/**
 * Build complete field type with array and optional wrapping
 */
export function buildFieldType(field: DMMF.Field, dmmf: DMMF.Document) {
  let baseType = mapFieldToEffectType(field, dmmf);

  // Handle arrays
  if (isListField(field)) {
    baseType = `Schema.Array(${baseType})`;
  }

  // Handle optional fields (only if NOT already has @default)
  if (!(isRequiredField(field) || hasDefaultValue(field))) {
    baseType = `Schema.NullOr(${baseType})`;
  }

  return baseType;
}
