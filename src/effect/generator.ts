import type { DMMF } from '@prisma/generator-helper';
import { buildKyselyFieldType, getMapRename } from '../kysely/type.js';
import { buildForeignKeyMap, type JoinTableInfo } from '../prisma/relation.js';
import { isUuidField } from '../prisma/type.js';
import { generateFileHeader } from '../utils/codegen.js';
import { toPascalCase } from '../utils/naming.js';
import {
  EMIT_BIGINT,
  EMIT_EFFECT_IMPORT,
  EMIT_INT,
  EMIT_STRING,
  EMIT_UUID,
  emitBrand,
  emitEncodeKeys,
} from './emit-tokens.js';
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
    const idField = fields.find((f) => f.isId);
    if (!idField) {
      return null;
    }

    const name = toPascalCase(model.name);
    const baseType = this.getIdBaseType(idField);

    // Export Id as both value and type with same name
    return `export const ${name}Id = ${emitBrand(baseType, `${name}Id`)};
export type ${name}Id = typeof ${name}Id.Type;`;
  }

  /**
   * Determine the base Effect Schema type for an ID field.
   * UUID strings → string with isUUID check, ints/bigints/strings → matching scalar.
   */
  private getIdBaseType(field: DMMF.Field) {
    if (isUuidField(field)) return EMIT_UUID;
    if (field.type === 'Int') return EMIT_INT;
    if (field.type === 'BigInt') return EMIT_BIGINT;
    return EMIT_STRING;
  }

  /**
   * Generate the main model schema
   * Exports as `User` directly (not `_User`)
   * Package's type utilities derive Insertable<User>, Selectable<User>
   */
  generateModelSchema(model: DMMF.Model, fields: readonly DMMF.Field[]) {
    const fkMap = buildForeignKeyMap(model, this.dmmf.datamodel.models);
    const name = toPascalCase(model.name);

    const renames: Record<string, string> = {};
    const fieldDefinitions = fields
      .map((field) => {
        const baseType = buildFieldType(field, this.dmmf, fkMap);
        const fieldType = buildKyselyFieldType(baseType, field, model.name);
        const rename = getMapRename(field);
        if (rename) {
          renames[rename[0]] = rename[1];
        }
        return `  ${field.name}: ${fieldType}`;
      })
      .join(',\n');

    const encodeKeysCall =
      Object.keys(renames).length > 0 ? `.pipe(${emitEncodeKeys(renames)})` : '';

    return `export const ${name} = Schema.Struct({
${fieldDefinitions}
})${encodeKeysCall};
export type ${name} = typeof ${name};`;
  }

  /**
   * Generate types.ts file header
   */
  generateTypesHeader(hasEnums: boolean) {
    const header = generateFileHeader();

    // Import runtime helpers from prisma-effect-kysely
    // columnType and generated are used for field type annotations
    const imports = [
      EMIT_EFFECT_IMPORT,
      `import { columnType, generated, JsonValue } from "prisma-effect-kysely";`,
    ];

    if (hasEnums) {
      // Import PascalCase enum schemas
      const enumImports = this.dmmf.datamodel.enums.map((e) => toPascalCase(e.name)).join(', ');

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
