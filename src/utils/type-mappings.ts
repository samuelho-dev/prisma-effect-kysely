/**
 * Centralized Prisma scalar mappings for generated Effect schemas.
 */

/**
 * Prisma scalar type mapping to Effect Schema types
 * Uses const assertion for type safety
 *
 * Database-boundary schemas preserve native dates, encode bigint as a string,
 * and use Effect's recursive JSON codec.
 */
export const PRISMA_TO_EFFECT_SCHEMA = {
  String: 'Schema.String',
  Int: 'Schema.Int',
  Float: 'Schema.Number',
  BigInt: 'Schema.BigIntFromString',
  Decimal: 'Schema.String',
  Boolean: 'Schema.Boolean',
  DateTime: 'Schema.Date',
  Json: 'Schema.Json',
  Bytes: 'Schema.Uint8Array',
} as const;

/**
 * Type-safe key type for Prisma scalar types
 */
export type PrismaScalarType = keyof typeof PRISMA_TO_EFFECT_SCHEMA;

/**
 * Type guard to check if a string is a valid Prisma scalar type
 */
export function isPrismaScalarType(type: string): type is PrismaScalarType {
  return type in PRISMA_TO_EFFECT_SCHEMA;
}

/**
 * Get Effect Schema type for a Prisma scalar type
 * Returns undefined for non-scalar types (enums, relations)
 */
export function getEffectSchemaType(type: string) {
  if (isPrismaScalarType(type)) {
    return PRISMA_TO_EFFECT_SCHEMA[type];
  }
  return undefined;
}
