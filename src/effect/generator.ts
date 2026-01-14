import type { DMMF } from '@prisma/generator-helper';
import { buildForeignKeyMap, type JoinTableInfo } from '../prisma/relation.js';
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
   * EXPORTED to allow TypeScript to reference by name in declaration emit
   * (prevents type expansion that breaks SchemasWithId type params)
   */
  generateBaseSchema(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    // Build FK map to determine which fields should use branded FK types
    // Only includes FKs that reference the target model's ID field
    const fkMap = buildForeignKeyMap(model, this.dmmf.datamodel.models);

    const fieldDefinitions = fields
      .map((field) => {
        const fieldType = buildFieldType(field, this.dmmf, fkMap);
        return `  ${field.name}: ${fieldType}`;
      })
      .join(',\n');

    const baseSchemaName = `_${model.name}`;

    return `// ${model.name} Base Schema (exported for TypeScript declaration emit)
export const ${baseSchemaName} = Schema.Struct({
${fieldDefinitions}
});`;
  }

  /**
   * Generate branded ID schema for a model
   * @returns The branded ID schema declaration + exported type, or null if no ID field
   */
  generateBrandedIdSchema(model: DMMF.Model, fields: readonly DMMF.Field[]): string | null {
    const idField = fields.find((f) => f.isId);
    if (!idField) {
      return null;
    }

    const name = toPascalCase(model.name);
    const isUuid = isUuidField(idField);
    const baseType = isUuid ? 'Schema.UUID' : 'Schema.String';

    // Export IdSchema so TypeScript can reference it by name in .d.ts files
    // (prevents type expansion that causes SchemasWithId to receive wrong # of type params)
    return `export const ${name}IdSchema = ${baseType}.pipe(Schema.brand("${name}Id"));
export type ${name}Id = typeof ${name}IdSchema.Type;`;
  }

  /**
   * Generate operational schemas with branded Id
   * Uses type annotation (:) for verification instead of type assertion (as)
   * Type annotations work correctly with TypeScript declaration emit
   */
  generateOperationalSchemas(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    const baseSchemaName = `_${model.name}`;
    const name = toPascalCase(model.name);
    const idField = fields.find((f) => f.isId);

    if (idField) {
      // Model with ID field - use type annotation (not assertion)
      return `// Operational schemas for ${name}
const _${name}Schemas = getSchemas(${baseSchemaName}, ${name}IdSchema);

export const ${name}: SchemasWithId<
  typeof ${baseSchemaName},
  typeof ${name}IdSchema
> = _${name}Schemas;`;
    }

    // Model without ID field - use type annotation (not assertion)
    return `// Operational schemas for ${name}
const _${name}Schemas = getSchemas(${baseSchemaName});

export const ${name}: Schemas<typeof ${baseSchemaName}> = _${name}Schemas;`;
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

    // Import getSchemas and type interfaces for type annotation pattern
    const imports = [
      `import { Schema } from "effect";`,
      `import type { ColumnType } from "kysely";`,
      `import { columnType, generated, getSchemas } from "prisma-effect-kysely";`,
      `import type { Schemas, SchemasWithId } from "prisma-effect-kysely";`,
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
