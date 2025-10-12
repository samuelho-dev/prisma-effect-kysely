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
   * Generate operational schemas as namespace (ModelName.Selectable, etc.)
   */
  generateOperationalSchemas(model: DMMF.Model) {
    const baseSchemaName = `_${model.name}`;
    const modelName = model.name;

    return `export namespace ${modelName} {
  const schemas = getSchemas(${baseSchemaName});
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}`;
  }

  /**
   * Generate TypeScript type exports as namespace
   */
  generateTypeExports(model: DMMF.Model) {
    const name = model.name;

    return `export namespace ${name} {
  export type Select = Schema.Schema.Type<typeof ${name}.Selectable>;
  export type Insert = Schema.Schema.Type<typeof ${name}.Insertable>;
  export type Update = Schema.Schema.Type<typeof ${name}.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof ${name}.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof ${name}.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof ${name}.Updateable>;
}`;
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
      `import * as Effect from "effect";`,
      `const Schema = Effect.Schema;`,
      `import { columnType, generated, getSchemas } from "prisma-effect-kysely";`,
    ];

    if (hasEnums) {
      // With namespace pattern, we only import the enum itself
      // Access Schema through namespace: EnumName.Schema
      const enumImports = this.dmmf.datamodel.enums
        .map((e) => e.name)  // Preserve original enum names
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
