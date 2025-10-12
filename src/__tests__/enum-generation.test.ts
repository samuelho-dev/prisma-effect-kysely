import { generateEnumSchema } from '../effect/enum';
import type { DMMF } from '@prisma/generator-helper';

describe('generateEnumSchema - Schema.Enums Pattern', () => {
  const mockEnum: DMMF.DatamodelEnum = {
    name: 'PRODUCT_STATUS',
    values: [
      { name: 'ARCHIVED', dbName: null },
      { name: 'DRAFT', dbName: null },
      { name: 'ACTIVE', dbName: null },
    ],
    dbName: null,
  };

  it('should generate native TypeScript enum with original name', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 1: Contains enum declaration with original name
    expect(result).toContain('export enum PRODUCT_STATUS {');

    // Test 2: Enum members have correct format
    expect(result).toContain('ARCHIVED = "ARCHIVED"');
    expect(result).toContain('DRAFT = "DRAFT"');
    expect(result).toContain('ACTIVE = "ACTIVE"');
  });

  it('should generate Effect.Schema.Enums wrapper in namespace', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 3: Schema wrapper exists in namespace using Effect.Schema
    expect(result).toContain('export namespace PRODUCT_STATUS');
    expect(result).toContain('export const Schema = Effect.Schema.Enums(PRODUCT_STATUS)');
  });

  it('should generate type alias in namespace', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 4: Type alias exists in namespace using Effect.Schema
    expect(result).toContain('export type Type = Effect.Schema.Schema.Type<typeof Schema>');
  });

  it('should preserve original enum name from Prisma schema', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 5: Preserves original SCREAMING_SNAKE_CASE
    expect(result).toContain('PRODUCT_STATUS');
    expect(result).not.toContain('ProductStatus');
  });

  it('should use Effect.Schema namespace prefix', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 6: Should use Effect.Schema instead of bare Schema
    expect(result).toContain('Effect.Schema');
    expect(result).not.toContain('Schema.Literal');
  });
});
