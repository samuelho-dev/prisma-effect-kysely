import type { DMMF } from '@prisma/generator-helper';
import { getEnumValueDbName } from '../prisma/enum.js';
import { generateFileHeader } from '../utils/codegen.js';
import { toPascalCase } from '../utils/naming.js';

/**
 * Generate TypeScript enum + Effect Schema.Enums wrapper
 *
 * Output pattern:
 * - Native TS enum with SCREAMING_SNAKE_CASE (internal, for Schema.Enums)
 * - PascalCase export IS the Schema (so it works in Schema.Struct)
 * - Type alias with same name (value + type pattern)
 */
export function generateEnumSchema(enumDef: DMMF.DatamodelEnum) {
  // PascalCase name with "Enum" suffix for the enum itself to avoid naming conflicts
  const enumPascalName = toPascalCase(enumDef.name) + 'Enum';
  // PascalCase name for the Schema (without suffix)
  const schemaName = toPascalCase(enumDef.name);

  // Generate native TypeScript enum members
  const enumMembers = enumDef.values
    .map((v) => {
      const value = getEnumValueDbName(v);
      return `  ${v.name} = "${value}"`;
    })
    .join(',\n');

  // Export PascalCase enum with "Enum" suffix to avoid naming conflicts
  // Export Schema with original PascalCase name
  return `export enum ${enumPascalName} {
${enumMembers}
}

export const ${schemaName} = Schema.Enums(${enumPascalName});
export type ${schemaName} = Schema.Schema.Type<typeof ${schemaName}>;`;
}

/**
 * Generate all enum schemas as a single file content
 * Returns null if there are no enums to avoid generating empty files
 */
export function generateEnumsFile(enums: readonly DMMF.DatamodelEnum[]) {
  if (enums.length === 0) {
    return null;
  }

  const header = generateFileHeader();
  const imports = `import { Schema } from "effect";`;
  const enumSchemas = enums.map(generateEnumSchema).join('\n\n');

  return `${header}\n\n${imports}\n\n${enumSchemas}`;
}
