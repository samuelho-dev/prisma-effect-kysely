import type { DMMF } from '@prisma/generator-helper';
import { generateEnumsFile } from './enum';
import { buildFieldType } from './type';
import { toPascalCase } from '../utils/naming';
import { generateFileHeader } from '../utils/codegen';
import { generateJoinTableSchema } from './join-table';
import type { JoinTableInfo } from '../prisma/relation';
import { hasDefaultValue } from '../prisma/type';

/**
 * Identify fields that should be omitted from Insert types
 *
 * Includes:
 * - Fields with @default (both ID and non-ID fields) - wrapped with generated() or columnType with Never
 * - Fields with @updatedAt directive - auto-managed by database
 *
 * Note: These fields are already filtered at runtime by v1.8.4 implementation.
 * We explicitly omit them in TypeScript types for compile-time safety.
 */
function getOmittedInsertFields(fields: readonly DMMF.Field[]): string[] {
  return fields
    .filter((field) => {
      // Fields with @default (includes IDs and regular generated fields)
      if (hasDefaultValue(field)) {
        return true;
      }

      // Fields with @updatedAt directive (DMMF provides isUpdatedAt property)
      if (field.isUpdatedAt === true) {
        return true;
      }

      return false;
    })
    .map((field) => field.name);
}

/**
 * Effect domain generator - orchestrates Effect Schema generation
 */
export class EffectGenerator {
  constructor(private readonly dmmf: DMMF.Document) {}

  /**
   * Generate enums.ts file content
   */
  generateEnums(enums: readonly DMMF.DatamodelEnum[]) {
    return generateEnumsFile(enums);
  }

  /**
   * Generate base schema for a model (_ModelName)
   */
  generateBaseSchema(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    const fieldDefinitions = fields
      .map((field) => {
        const fieldType = buildFieldType(field, this.dmmf);
        return `  ${field.name}: ${fieldType}`;
      })
      .join(',\n');

    const baseSchemaName = `_${model.name}`;

    return `// ${model.name} Base Schema
export const ${baseSchemaName} = Schema.Struct({
${fieldDefinitions}
});`;
  }

  /**
   * Generate operational schemas (ModelName.Selectable, etc.)
   */
  generateOperationalSchemas(model: DMMF.Model) {
    const baseSchemaName = `_${model.name}`;
    const operationalSchemaName = toPascalCase(model.name);

    return `export const ${operationalSchemaName} = getSchemas(${baseSchemaName});`;
  }

  /**
   * Generate TypeScript type exports with explicit Omit for generated fields
   */
  generateTypeExports(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    const name = toPascalCase(model.name);
    const omittedFields = getOmittedInsertFields(fields);

    // Generate Insert type with explicit Omit for generated/auto-managed fields
    const insertType =
      omittedFields.length > 0
        ? `Omit<Schema.Schema.Type<typeof ${name}.Insertable>, ${omittedFields.map((f) => `'${f}'`).join(' | ')}>`
        : `Schema.Schema.Type<typeof ${name}.Insertable>`;

    const insertEncodedType =
      omittedFields.length > 0
        ? `Omit<Schema.Schema.Encoded<typeof ${name}.Insertable>, ${omittedFields.map((f) => `'${f}'`).join(' | ')}>`
        : `Schema.Schema.Encoded<typeof ${name}.Insertable>`;

    // Application-side types (decoded - for repository layer)
    const applicationTypes = `export type ${name}Select = Schema.Schema.Type<typeof ${name}.Selectable>;
export type ${name}Insert = ${insertType};
export type ${name}Update = Schema.Schema.Type<typeof ${name}.Updateable>;`;

    // Database-side encoded types (for queries layer)
    const encodedTypes = `
export type ${name}SelectEncoded = Schema.Schema.Encoded<typeof ${name}.Selectable>;
export type ${name}InsertEncoded = ${insertEncodedType};
export type ${name}UpdateEncoded = Schema.Schema.Encoded<typeof ${name}.Updateable>;`;

    return applicationTypes + encodedTypes;
  }

  /**
   * Generate complete model schema (base + operational + types)
   */
  generateModelSchema(model: DMMF.Model, fields: DMMF.Field[]) {
    const baseSchema = this.generateBaseSchema(model, fields);
    const operationalSchema = this.generateOperationalSchemas(model);
    const typeExports = this.generateTypeExports(model, fields);

    return `${baseSchema}\n\n${operationalSchema}\n\n${typeExports}`;
  }

  /**
   * Generate types.ts file header
   *
   * TDD: Satisfies tests 13-15 in import-generation.test.ts
   */
  generateTypesHeader(hasEnums: boolean) {
    const header = generateFileHeader();

    const imports = [
      `import { Schema } from "effect";`,
      `import { columnType, generated, getSchemas } from "prisma-effect-kysely";`,
    ];

    if (hasEnums) {
      // Only import Schema wrappers (not plain enum types)
      // Use PascalCase naming with Schema suffix
      // No SCREAMING_SNAKE_CASE
      const enumImports = this.dmmf.datamodel.enums
        .map((e) => {
          const baseName = toPascalCase(e.name);
          return `${baseName}Schema`;
        })
        .join(', ');

      imports.push(`import { ${enumImports} } from "./enums";`);
    }

    return `${header}\n\n${imports.join('\n')}`;
  }

  /**
   * Generate schemas for all join tables
   */
  generateJoinTableSchemas(joinTables: JoinTableInfo[]) {
    return joinTables.map((jt) => generateJoinTableSchema(jt, this.dmmf)).join('\n\n');
  }
}
