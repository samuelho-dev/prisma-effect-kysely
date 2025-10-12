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

  it('should generate Schema.Enums wrapper with PascalCase', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 3: Schema wrapper uses PascalCase
    expect(result).toContain('export const ProductStatusSchema = Schema.Enums(PRODUCT_STATUS)');
  });

  it('should generate type alias with PascalCase', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 4: Type alias uses PascalCase
    expect(result).toContain('export type ProductStatusType = Schema.Schema.Type<typeof ProductStatusSchema>');
  });

  it('should preserve original enum name but use PascalCase for Schema/Type', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 5: Enum keeps SCREAMING_SNAKE_CASE
    expect(result).toContain('export enum PRODUCT_STATUS');
    // Schema and Type use PascalCase
    expect(result).toContain('ProductStatusSchema');
    expect(result).toContain('ProductStatusType');
  });

  it('should NOT generate Schema.Literal', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 6: Old pattern should not exist
    expect(result).not.toContain('Schema.Literal');
  });
});
