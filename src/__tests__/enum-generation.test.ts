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

  it('should generate native TypeScript enum with PascalCase name', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 1: Contains enum declaration
    expect(result).toContain('export enum ProductStatus {');

    // Test 2: Enum members have correct format
    expect(result).toContain('ARCHIVED = "ARCHIVED"');
    expect(result).toContain('DRAFT = "DRAFT"');
    expect(result).toContain('ACTIVE = "ACTIVE"');
  });

  it('should generate Schema.Enums wrapper', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 3: Schema wrapper exists
    expect(result).toContain('export const ProductStatusSchema = Schema.Enums(ProductStatus)');
  });

  it('should generate type alias', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 4: Type alias exists
    expect(result).toContain('export type ProductStatusType = Schema.Schema.Type<typeof ProductStatusSchema>');
  });

  it('should convert SCREAMING_SNAKE_CASE to PascalCase', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 5: No SCREAMING_SNAKE_CASE in enum name
    expect(result).not.toContain('PRODUCT_STATUS');
    expect(result).toContain('ProductStatus');
  });

  it('should NOT generate Schema.Literal', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 6: Old pattern should not exist
    expect(result).not.toContain('Schema.Literal');
  });
});
