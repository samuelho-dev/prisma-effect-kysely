import type { DMMF } from '@prisma/generator-helper';
import { getEnumValueDbName } from '../prisma/enum.js';
import { generateFileHeader } from '../utils/codegen.js';
import { toPascalCase } from '../utils/naming.js';

/**
 * Generate a TypeScript enum and Effect Schema.Enum codec.
 */
export function generateEnumSchema(enumDef: DMMF.DatamodelEnum) {
  const enumName = enumDef.name;
  const pascalName = toPascalCase(enumName);
  const nativeEnumName = enumName === pascalName ? `${enumName}Values` : enumName;

  // Generate native TypeScript enum members
  const enumMembers = enumDef.values
    .map((v) => {
      const value = getEnumValueDbName(v);
      return `  ${v.name} = "${value}"`;
    })
    .join(',\n');

  // Export PascalCase as the schema and decoded type.
  return `export enum ${nativeEnumName} {
${enumMembers}
}

export const ${pascalName} = Schema.Enum(${nativeEnumName});
export type ${pascalName} = typeof ${pascalName}.Type;`;
}

/**
 * Generate all enum schemas as a single file content
 */
export function generateEnumsFile(enums: readonly DMMF.DatamodelEnum[]) {
  const header = generateFileHeader();
  const imports = `import { Schema } from "effect";`;
  const enumSchemas = enums.map(generateEnumSchema).join('\n\n');

  return `${header}\n\n${imports}\n\n${enumSchemas}`;
}
