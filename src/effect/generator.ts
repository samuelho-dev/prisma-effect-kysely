import type { DMMF } from '@prisma/generator-helper';
import type { JoinTableInfo } from '../prisma/relation.js';
import { isUuidField } from '../prisma/type.js';
import { generateFileHeader } from '../utils/codegen.js';
import { toPascalCase } from '../utils/naming.js';
import { generateEnumsFile } from './enum.js';
import { generateJoinTableKyselyInterface, generateJoinTableSchema } from './join-table.js';
import { buildFieldType } from './type.js';

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

    return `// ${model.name} Base Schema (internal)
const ${baseSchemaName} = Schema.Struct({
${fieldDefinitions}
});`;
  }

  /**
   * Generate branded ID schema for a model
   * @returns The branded ID schema declaration, or null if no ID field
   */
  generateBrandedIdSchema(model: DMMF.Model, fields: readonly DMMF.Field[]): string | null {
    const idField = fields.find((f) => f.isId);
    if (!idField) {
      return null;
    }

    const name = toPascalCase(model.name);
    const isUuid = isUuidField(idField);
    const baseType = isUuid ? 'Schema.UUID' : 'Schema.String';

    return `const ${name}IdSchema = ${baseType}.pipe(Schema.brand("${name}Id"));`;
  }

  /**
   * Generate operational schemas with branded Id
   * Exports: { Selectable, Insertable, Updateable, Id }
   */
  generateOperationalSchemas(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    const baseSchemaName = `_${model.name}`;
    const name = toPascalCase(model.name);
    const idField = fields.find((f) => f.isId);

    if (idField) {
      // Use getSchemas(base, id) to preserve _base for type utilities
      return `export const ${name} = getSchemas(${baseSchemaName}, ${name}IdSchema);`;
    }

    return `export const ${name} = getSchemas(${baseSchemaName});`;
  }

  /**
   * Generate complete model schema (base + branded ID + operational)
   * No type exports - consumers use type utilities: Selectable<typeof User>
   */
  generateModelSchema(model: DMMF.Model, fields: DMMF.Field[]) {
    const parts: string[] = [];

    // Branded ID schema (if model has ID field)
    const brandedIdSchema = this.generateBrandedIdSchema(model, fields);
    if (brandedIdSchema) {
      parts.push(brandedIdSchema);
    }

    // Base schema
    parts.push(this.generateBaseSchema(model, fields));

    // Operational schemas with Id
    parts.push(this.generateOperationalSchemas(model, fields));

    return parts.join('\n\n');
  }

  /**
   * Generate types.ts file header
   *
   * TDD: Satisfies tests 13-15 in import-generation.test.ts
   */
  generateTypesHeader(hasEnums: boolean) {
    const header = generateFileHeader();

    // No StrictType import - consumers use type utilities: Selectable<typeof User>
    const imports = [
      `import { Schema } from "effect";`,
      `import type { ColumnType } from "kysely";`,
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

      imports.push(`import { ${enumImports} } from "./enums.js";`);
    }

    return `${header}\n\n${imports.join('\n')}`;
  }

  /**
   * Generate schemas for all join tables
   */
  generateJoinTableSchemas(joinTables: JoinTableInfo[]) {
    return joinTables.map((jt) => generateJoinTableSchema(jt, this.dmmf)).join('\n\n');
  }

  /**
   * Generate Kysely table interfaces for join tables
   */
  generateJoinTableKyselyInterfaces(joinTables: JoinTableInfo[]) {
    return joinTables.map(generateJoinTableKyselyInterface).join('\n\n');
  }
}
