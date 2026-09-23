import type { DMMF } from '@prisma/generator-helper';
import { getEnumValueDbName, type PrismaEnumDefinition } from '../prisma/enum.js';
import { generateFileHeader } from '../utils/codegen.js';
import { toPascalCase } from '../utils/naming.js';

/**
 * Generate named enum members and their Effect codec.
 */
export function generateEnumSchema(enumDef: PrismaEnumDefinition) {
  const schemaName = toPascalCase(enumDef.name);
  const enumName = enumDef.name === schemaName ? `${schemaName}Enum` : enumDef.name;
  const members = enumDef.values
    .map((value) => `  ${value.name} = ${JSON.stringify(getEnumValueDbName(value))}`)
    .join(',\n');

  return `export enum ${enumName} {
${members}
}

export const ${schemaName} = Schema.Enum(${enumName});
export type ${schemaName} = typeof ${schemaName}.Type;`;
}

/**
 * Generate all enum schemas as a single file content.
 */
export function generateEnumsFile(enums: readonly DMMF.DatamodelEnum[]) {
  const header = generateFileHeader();
  const imports = `import { Schema } from "effect";`;
  const enumSchemas = enums.map(generateEnumSchema).join('\n\n');

  return `${header}\n\n${imports}\n\n${enumSchemas}`;
}
