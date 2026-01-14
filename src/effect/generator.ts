import type { DMMF } from '@prisma/generator-helper';
import { buildForeignKeyMap, type JoinTableInfo } from '../prisma/relation.js';
import { hasDefaultValue, isUuidField } from '../prisma/type.js';
import { generateFileHeader } from '../utils/codegen.js';
import { toPascalCase } from '../utils/naming.js';
import { generateEnumsFile } from './enum.js';
import { generateJoinTableKyselyInterface, generateJoinTableSchema } from './join-table.js';
import { buildFieldType, buildInsertableFieldType } from './type.js';

/**
 * Determine if field should be omitted from explicit Insertable schema
 * ID fields with @default and non-ID fields with @default are omitted
 */
function needsOmitFromInsert(field: DMMF.Field): boolean {
  return hasDefaultValue(field);
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
   * Generate explicit Insertable schema for a model
   * This schema only includes fields that should be present during INSERT operations
   * Fields with @default are omitted since the database generates them
   *
   * This is the key fix for declaration emit issues:
   * - The base schema uses generated()/columnType() wrappers which get simplified in .d.ts
   * - This explicit schema has no wrappers, so TypeScript preserves the exact types
   */
  generateInsertableSchema(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    const fkMap = buildForeignKeyMap(model, this.dmmf.datamodel.models);

    // Filter out fields that should be omitted from insert
    const insertableFields = fields.filter((field) => !needsOmitFromInsert(field));

    const fieldDefinitions = insertableFields
      .map((field) => {
        const fieldType = buildInsertableFieldType(field, this.dmmf, fkMap);
        return `  ${field.name}: ${fieldType}`;
      })
      .join(',\n');

    const insertableSchemaName = `_${model.name}_insertable`;

    return `// ${model.name} Insertable Schema (explicit - avoids declaration emit issues)
export const ${insertableSchemaName} = Schema.Struct({
${fieldDefinitions}
});`;
  }

  /**
   * Generate operational schemas with branded Id
   * Uses explicit Insertable schema instead of computed one to survive declaration emit
   */
  generateOperationalSchemas(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    const baseSchemaName = `_${model.name}`;
    const insertableSchemaName = `_${model.name}_insertable`;
    const name = toPascalCase(model.name);
    const idField = fields.find((f) => f.isId);

    if (idField) {
      // Model with ID field - override Insertable with explicit schema
      return `// Operational schemas for ${name}
export const ${name} = {
  ...getSchemas(${baseSchemaName}, ${name}IdSchema),
  Insertable: ${insertableSchemaName},
};`;
    }

    // Model without ID field - override Insertable with explicit schema
    return `// Operational schemas for ${name}
export const ${name} = {
  ...getSchemas(${baseSchemaName}),
  Insertable: ${insertableSchemaName},
};`;
  }

  /**
   * Generate complete model schema (base + branded ID + insertable + operational)
   * No type exports - consumers use type utilities: Selectable<typeof User>
   */
  generateModelSchema(model: DMMF.Model, fields: DMMF.Field[]) {
    const parts: string[] = [];

    // Branded ID schema (if model has ID field)
    const brandedIdSchema = this.generateBrandedIdSchema(model, fields);
    if (brandedIdSchema) {
      parts.push(brandedIdSchema);
    }

    // Base schema (with generated()/columnType() wrappers)
    parts.push(this.generateBaseSchema(model, fields));

    // Explicit Insertable schema (without wrappers - survives declaration emit)
    parts.push(this.generateInsertableSchema(model, fields));

    // Operational schemas with Id (uses explicit Insertable)
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

    // Import getSchemas (no type imports needed - explicit Insertable pattern)
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
