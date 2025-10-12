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

  it('should generate Schema.Enums wrapper', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 3: Schema wrapper exists with original name
    expect(result).toContain('export const PRODUCT_STATUSSchema = Schema.Enums(PRODUCT_STATUS)');
  });

  it('should generate type alias', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 4: Type alias exists with original name
    expect(result).toContain('export type PRODUCT_STATUSType = Schema.Schema.Type<typeof PRODUCT_STATUSSchema>');
  });

  it('should preserve original enum name from Prisma schema', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 5: Preserves original SCREAMING_SNAKE_CASE
    expect(result).toContain('PRODUCT_STATUS');
    expect(result).not.toContain('ProductStatus');
  });

  it('should NOT generate Schema.Literal', () => {
    const result = generateEnumSchema(mockEnum);

    // Test 6: Old pattern should not exist
    expect(result).not.toContain('Schema.Literal');
  });
});
