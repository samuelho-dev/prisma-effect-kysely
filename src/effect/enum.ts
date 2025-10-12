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

  // Generate native TypeScript enum members
  const enumMembers = enumDef.values
    .map((v) => {
      const value = getEnumValueDbName(v);
      return `  ${v.name} = "${value}"`;
    })
    .join(",\n");

  // Get first enum value for example
  const firstValue = enumDef.values[0]?.name || 'VALUE';

  // Get enum values as type union for JSDoc
  const enumValueUnion = enumDef.values
    .map(v => `'${getEnumValueDbName(v)}'`)
    .join(' | ');

  // Generate: enum + Schema.Enums() wrapper + type with JSDoc
  return `/**
 * ${enumName} enum from Prisma schema.
 * @see {@link ${schemaName}} for Effect Schema validation
 * @see {@link ${typeName}} for TypeScript type
 */
export enum ${enumName} {
${enumMembers}
}

/**
 * Effect Schema validator for ${enumName} enum.
 * Validates that a value is a valid ${enumName} enum member.
 *
 * @example
 * const validated = Schema.decodeSync(${schemaName})("${firstValue}");
 */
export const ${schemaName} = Schema.Enums(${enumName});

/**
 * TypeScript type for ${enumName} enum values.
 * Equivalent to: ${enumValueUnion}
 */
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
