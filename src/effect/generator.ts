import type { DMMF } from '@prisma/generator-helper';
import { generateEnumsFile } from './enum';
import { buildFieldType } from './type';
import { getFieldDbName } from '../prisma/type';
import { toPascalCase } from '../utils/naming';
import { generateFileHeader } from '../utils/codegen';
import { generateJoinTableSchema } from './join-table';
import type { JoinTableInfo } from '../prisma/relation';

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
   * Generate TypeScript type exports
   */
  generateTypeExports(model: DMMF.Model) {
    const name = toPascalCase(model.name);

    // Application-side types (decoded - for repository layer)
    const applicationTypes = `export type ${name}Select = Schema.Schema.Type<typeof ${name}.Selectable>;
export type ${name}Insert = Schema.Schema.Type<typeof ${name}.Insertable>;
export type ${name}Update = Schema.Schema.Type<typeof ${name}.Updateable>;`;

    // Database-side encoded types (for queries layer)
    const encodedTypes = `
export type ${name}SelectEncoded = Schema.Schema.Encoded<typeof ${name}.Selectable>;
export type ${name}InsertEncoded = Schema.Schema.Encoded<typeof ${name}.Insertable>;
export type ${name}UpdateEncoded = Schema.Schema.Encoded<typeof ${name}.Updateable>;`;

    return applicationTypes + encodedTypes;
  }

  /**
   * Generate complete model schema (base + operational + types)
   */
  generateModelSchema(model: DMMF.Model, fields: DMMF.Field[]) {
    const baseSchema = this.generateBaseSchema(model, fields);
    const operationalSchema = this.generateOperationalSchemas(model);
    const typeExports = this.generateTypeExports(model);

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
      // Test 13: Import both enum and Schema wrapper
      // Test 14: Use PascalCase naming
      // Test 15: No SCREAMING_SNAKE_CASE
      const enumImports = this.dmmf.datamodel.enums
        .flatMap((e) => {
          const baseName = toPascalCase(e.name);
          return [baseName, `${baseName}Schema`];
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
    return joinTables
      .map((jt) => generateJoinTableSchema(jt, this.dmmf))
      .join('\n\n');
  }
}
