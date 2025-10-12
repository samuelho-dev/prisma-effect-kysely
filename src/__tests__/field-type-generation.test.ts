import { buildFieldType } from '../effect/type';
import { createMockDMMF, createMockEnum, createMockField } from './helpers/dmmf-mocks';

describe('buildFieldType - Enum Field Mapping', () => {
  const mockDMMF = createMockDMMF({
    enums: [createMockEnum('PRODUCT_STATUS', [])],
    models: []
  });

  const mockEnumField = createMockField({
    name: 'status',
    kind: 'enum',
    type: 'PRODUCT_STATUS',
    isList: false,
    isRequired: true,
    isUnique: false,
    isId: false,
    isReadOnly: false,
    hasDefaultValue: false,
    isGenerated: false,
    isUpdatedAt: false,
  });

  it('should map enum field to suffix Schema pattern', () => {
    const result = buildFieldType(mockEnumField, mockDMMF);

    // Test 11: Returns Schema with suffix (v1.7.0+)
    expect(result).toBe('PRODUCT_STATUSSchema');
    expect(result).not.toBe('ProductStatus');
    expect(result).not.toBe('PRODUCT_STATUS');
    expect(result).not.toBe('PRODUCT_STATUS.Schema');
  });

  it('should preserve original enum name with Schema suffix', () => {
    const result = buildFieldType(mockEnumField, mockDMMF);

    // Test 12: Uses suffix pattern EnumNameSchema
    expect(result).toMatch(/^[A-Z_]+Schema$/);
    expect(result).toContain('PRODUCT_STATUS');
  });
});
