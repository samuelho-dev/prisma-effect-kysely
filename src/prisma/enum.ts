import type { DMMF } from '@prisma/generator-helper';

export interface PrismaEnumValue {
  readonly name: string;
  readonly dbName?: string | number | null;
}

export interface PrismaEnumDefinition {
  readonly name: string;
  readonly values: readonly PrismaEnumValue[];
}

/**
 * Extract enum definitions from Prisma DMMF.
 */
export function extractEnums(dmmf: DMMF.Document) {
  return dmmf.datamodel.enums;
}

/**
 * Get the stored value for an enum member, preserving numeric domain literals.
 */
export function getEnumValueDbName(enumValue: PrismaEnumValue): string | number {
  return enumValue.dbName ?? enumValue.name;
}

/**
 * Get all stored values for an enum.
 */
export function getEnumDbValues(enumDef: PrismaEnumDefinition) {
  return enumDef.values.map(getEnumValueDbName);
}
