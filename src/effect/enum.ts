import type { DMMF } from "@prisma/generator-helper";
import { getEnumValueDbName } from "../prisma/enum";
import { toPascalCase } from "../utils/naming";
import { generateFileHeader } from "../utils/codegen";

/**
 * Generate TypeScript enum + Effect Schema.Enums wrapper
 *
 * TDD: Satisfies tests 1-6 in enum-generation.test.ts
 *
 * Output pattern:
 * - Native TS enum with property accessors
 * - Effect Schema.Enums() wrapper for validation
 * - Type alias for convenience
 */
export function generateEnumSchema(enumDef: DMMF.DatamodelEnum) {
  // Preserve original enum name from Prisma schema
  const enumName = enumDef.name;
  const schemaName = `${enumName}Schema`;
  const typeName = `${enumName}Type`;

  // Generate native TypeScript enum members (Tests 1-2)
  const enumMembers = enumDef.values
    .map((v) => {
      const value = getEnumValueDbName(v);
      return `  ${v.name} = "${value}"`;
    })
    .join(",\n");

  // Generate: enum + Schema.Enums() wrapper + type (Tests 3-4)
  // Explicitly NOT using Schema.Literal (Test 6)
  return `export enum ${enumName} {
${enumMembers}
}

export const ${schemaName} = Schema.Enums(${enumName});

export type ${typeName} = Schema.Schema.Type<typeof ${schemaName}>;`;
}

/**
 * Generate all enum schemas as a single file content
 */
export function generateEnumsFile(enums: readonly DMMF.DatamodelEnum[]) {
  const header = generateFileHeader();
  const imports = `import { Schema } from "effect";`;
  const enumSchemas = enums.map(generateEnumSchema).join("\n\n");

  return `${header}\n\n${imports}\n\n${enumSchemas}`;
}
