import type { DMMF } from '@prisma/generator-helper';
import { buildFieldType } from '../effect/type.js';
import { buildForeignKeyMap, type JoinTableInfo } from '../prisma/relation.js';
import { buildKyselyFieldType, generateDBInterface, generateKyselyTableInterface } from './type.js';

/**
 * Kysely domain generator - orchestrates Kysely integration
 * Applies Kysely helpers to Effect schemas
 */
export class KyselyGenerator {
  constructor(private readonly dmmf: DMMF.Document) {}

  /**
   * Generate field definition with Kysely helpers applied
   *
   * @param field - The field to generate
   * @param fkMap - Optional FK field → target model mapping for branded FK types
   */
  generateFieldWithKysely(field: DMMF.Field, fkMap?: Map<string, string>) {
    // Get base Effect type (pass FK map for branded FK types)
    const baseFieldType = buildFieldType(field, this.dmmf, fkMap);

    // Apply Kysely helpers and @map
    const kyselyFieldType = buildKyselyFieldType(baseFieldType, field);

    return `  ${field.name}: ${kyselyFieldType}`;
  }

  /**
   * Generate all fields for a model with Kysely integration
   *
   * @param model - The full model (needed for FK detection)
   * @param fields - The filtered/sorted fields to generate
   */
  generateModelFields(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    // Build FK map for this model to enable branded FK types
    // Pass all models so we can verify FK points to target's ID field
    const fkMap = buildForeignKeyMap(model, this.dmmf.datamodel.models);

    return Array.from(fields)
      .map((field) => this.generateFieldWithKysely(field, fkMap))
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
