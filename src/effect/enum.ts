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

  // Generate native TypeScript enum members
  const enumMembers = enumDef.values
    .map((v) => {
      const value = getEnumValueDbName(v);
      return `  ${v.name} = "${value}"`;
    })
    .join(",\n");

  // Generate: enum + namespace with Schema and Type
  return `export enum ${enumName} {
${enumMembers}
}

export namespace ${enumName} {
  export const Schema = Effect.Schema.Enums(${enumName});
  export type Type = Effect.Schema.Schema.Type<typeof Schema>;
}`;
}

/**
 * Generate all enum schemas as a single file content
 */
export function generateEnumsFile(enums: readonly DMMF.DatamodelEnum[]) {
  const header = generateFileHeader();
  const imports = `import * as Effect from "effect";\nconst Schema = Effect.Schema;`;
  const enumSchemas = enums.map(generateEnumSchema).join("\n\n");

  return `${header}\n\n${imports}\n\n${enumSchemas}`;
}
