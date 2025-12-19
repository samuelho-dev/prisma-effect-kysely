import type { DMMF } from '@prisma/generator-helper';
import { buildFieldType } from '../effect/type.js';
import type { JoinTableInfo } from '../prisma/relation.js';
import { buildKyselyFieldType, generateDBInterface, generateKyselyTableInterface } from './type.js';

/**
 * Kysely domain generator - orchestrates Kysely integration
 * Applies Kysely helpers to Effect schemas
 */
export class KyselyGenerator {
  constructor(private readonly dmmf: DMMF.Document) {}

  /**
   * Generate field definition with Kysely helpers applied
   */
  generateFieldWithKysely(field: DMMF.Field) {
    // Get base Effect type
    const baseFieldType = buildFieldType(field, this.dmmf);

    // Apply Kysely helpers and @map
    const kyselyFieldType = buildKyselyFieldType(baseFieldType, field);

    return `  ${field.name}: ${kyselyFieldType}`;
  }

  /**
   * Generate all fields for a model with Kysely integration
   */
  generateModelFields(fields: readonly DMMF.Field[]) {
    return Array.from(fields)
      .map((field) => this.generateFieldWithKysely(field))
      .join(',\n');
  }

  /**
   * Generate Kysely table interface for a model
   */
  generateTableInterface(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    return generateKyselyTableInterface(model, fields, this.dmmf);
  }

  /**
   * Generate DB interface for all models and join tables
   */
  generateDBInterface(models: readonly DMMF.Model[], joinTables: JoinTableInfo[] = []) {
    return generateDBInterface(models, joinTables);
  }

  /**
   * Generate index.ts re-export file
   */
  generateIndexFile() {
    return `export * from "./enums.js";\nexport * from "./types.js";`;
  }
}
