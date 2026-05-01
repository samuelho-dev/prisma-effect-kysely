import type { DMMF } from '@prisma/generator-helper';
import { getEnumValueDbName } from '../prisma/enum.js';
import { generateFileHeader } from '../utils/codegen.js';
import { toPascalCase } from '../utils/naming.js';
import { EMIT_EFFECT_IMPORT, emitLiterals, emitSchemaType } from './emit-tokens.js';

/**
 * Generate TypeScript enum + Effect `Schema.Literals` wrapper.
 *
 * Output pattern:
 * - Native TS enum with SCREAMING_SNAKE_CASE for downstream `keyof typeof` use
 * - PascalCase export IS the Schema (so it works in `Schema.Struct`); v4 has
 *   no `Schema.Enums`, so this is `Schema.Literals([...db values])`.
 * - Type alias with the same name (value + type pattern)
 */
export function generateEnumSchema(enumDef: DMMF.DatamodelEnum) {
  // Raw enum keeps original name (usually SCREAMING_SNAKE_CASE)
  const enumName = enumDef.name;
  // PascalCase name is exported as BOTH the Schema value AND the type
  const pascalName = toPascalCase(enumDef.name);

  // Generate native TypeScript enum members
  const enumMembers = enumDef.values
    .map((v) => {
      const value = getEnumValueDbName(v);
      return `  ${v.name} = "${value}"`;
    })
    .join(',\n');

  const dbValues = enumDef.values.map((v) => getEnumValueDbName(v));

  // Export PascalCase as the Schema (not raw enum)
  // This allows PayoutStatus to be used directly in Schema.Struct fields
  // Also export type with same name for Insertable<User> pattern
  return `export enum ${enumName} {
${enumMembers}
}

export const ${pascalName} = ${emitLiterals(dbValues)};
export type ${pascalName} = ${emitSchemaType(pascalName)};`;
}

/**
 * Generate all enum schemas as a single file content
 */
export function generateEnumsFile(enums: readonly DMMF.DatamodelEnum[]) {
  const header = generateFileHeader();
  const imports = EMIT_EFFECT_IMPORT;
  const enumSchemas = enums.map(generateEnumSchema).join('\n\n');

  return `${header}\n\n${imports}\n\n${enumSchemas}`;
}
