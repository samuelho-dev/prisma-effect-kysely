import type { DMMF } from '@prisma/generator-helper';
import {
  buildForeignKeyMap,
  getModelIdBrandModel,
  type JoinTableInfo,
} from '../prisma/relation.js';
import { getFieldOperationConfig, getFieldDbName } from '../prisma/type.js';
import { generateFileHeader } from '../utils/codegen.js';
import { toPascalCase } from '../utils/naming.js';
import { generateEnumsFile } from './enum.js';
import { generateJoinTableSchema } from './join-table.js';
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
   * Generate branded ID schema for a model
   * @returns The branded ID schema declaration + exported type, or null if no ID field
   */
  generateBrandedIdSchema(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    const idField = fields.find((field) => field.isId);
    const brandModel = getModelIdBrandModel(model, this.dmmf.datamodel.models);
    if (!idField || brandModel?.name !== model.name) {
      return null;
    }

    const name = toPascalCase(model.name);
    const baseType = buildFieldType(idField, this.dmmf);

    return `export const ${name}Id = ${baseType}.pipe(Schema.brand("${name}Id"));
export type ${name}Id = typeof ${name}Id.Type;`;
  }

  /**
   * Generate select, insert, and update codecs from one shared field definition.
   */
  generateModelSchema(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    const fkMap = buildForeignKeyMap(model, this.dmmf.datamodel.models);
    const name = toPascalCase(model.name);
    const fieldDefinitions = fields
      .map((field) => {
        const valueSchema =
          field.isId && !fkMap.has(field.name)
            ? `${name}Id`
            : buildFieldType(field, this.dmmf, fkMap);
        const operation = getFieldOperationConfig(model, field);
        const variants = [
          `    select: ${valueSchema}`,
          `    insert: ${operation.insertOptional ? `Schema.optionalKey(${valueSchema})` : valueSchema}`,
        ];

        if (operation.update) {
          variants.push(`    update: Schema.optionalKey(${valueSchema})`);
        }

        return `  ${field.name}: DatabaseSchema.Field({
${variants.join(',\n')},
  })`;
      })
      .join(',\n');
    const modelFields = `${name}Fields`;
    const codecs = (['select', 'insert', 'update'] as const)
      .map((variant) => this.generateOperationCodec(name, modelFields, model, fields, variant))
      .join('\n\n');

    return `const ${modelFields} = DatabaseSchema.Struct({
${fieldDefinitions}
});

${codecs}`;
  }

  private generateOperationCodec(
    modelName: string,
    modelFields: string,
    model: DMMF.Model,
    fields: readonly DMMF.Field[],
    variant: 'select' | 'insert' | 'update'
  ) {
    const codecName =
      variant === 'select'
        ? modelName
        : `${modelName}${variant === 'insert' ? 'Insert' : 'Update'}`;
    const mappedFields = fields.filter(
      (field) =>
        field.dbName !== null &&
        field.dbName !== undefined &&
        field.dbName !== field.name &&
        (variant !== 'update' || getFieldOperationConfig(model, field).update)
    );
    const extracted = `DatabaseSchema.extract(${modelFields}, "${variant}")`;
    const codec =
      mappedFields.length === 0
        ? extracted
        : `${extracted}.pipe(Schema.encodeKeys({ ${mappedFields
            .map(
              (field) => `${JSON.stringify(field.name)}: ${JSON.stringify(getFieldDbName(field))}`
            )
            .join(', ')} }))`;

    return `export const ${codecName} = ${codec};
export type ${codecName} = typeof ${codecName}.Type;`;
  }

  /**
   * Generate types.ts imports and the shared operation-schema toolkit.
   */
  generateTypesHeader(hasEnums: boolean) {
    const header = generateFileHeader();
    const imports = [
      `import { Schema } from "effect";`,
      `import { VariantSchema } from "effect/unstable/schema";`,
      `import type { ColumnType } from "kysely";`,
    ];

    if (hasEnums) {
      const enumImports = this.dmmf.datamodel.enums.map((e) => toPascalCase(e.name)).join(', ');
      imports.push(`import { ${enumImports} } from "./enums";`);
    }

    return `${header}

${imports.join('\n')}

const DatabaseSchema = VariantSchema.make({
  variants: ["select", "insert", "update"],
  defaultVariant: "select",
});`;
  }

  /**
   * Generate schemas for all join tables
   */
  generateJoinTableSchemas(joinTables: JoinTableInfo[]) {
    return joinTables.map((jt) => generateJoinTableSchema(jt, this.dmmf)).join('\n\n');
  }
}
