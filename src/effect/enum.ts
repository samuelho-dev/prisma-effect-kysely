import type { DMMF } from '@prisma/generator-helper';
import { getEnumValueDbName, type PrismaEnumDefinition } from '../prisma/enum.js';
import { generateFileHeader } from '../utils/codegen.js';
import { toPascalCase } from '../utils/naming.js';

/**
 * Generate an Effect Schema codec from the stored values of a Prisma enum.
 */
export function generateEnumSchema(enumDef: PrismaEnumDefinition) {
  const enumName = toPascalCase(enumDef.name);
  const values = enumDef.values
    .map(getEnumValueDbName)
    .map((value) => JSON.stringify(value))
    .join(', ');

  return `export const ${enumName} = Schema.Literals([${values}]);
export type ${enumName} = typeof ${enumName}.Type;`;
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
