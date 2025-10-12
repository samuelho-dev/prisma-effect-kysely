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

  it('should map enum field to namespace Schema accessor', () => {
    const result = buildFieldType(mockEnumField, mockDMMF);

    // Test 11: Returns Schema via namespace (v1.6.0+)
    expect(result).toBe('PRODUCT_STATUS.Schema');
    expect(result).not.toBe('ProductStatus');
    expect(result).not.toBe('PRODUCT_STATUS');
    expect(result).not.toBe('ProductStatusSchema');
  });

  it('should preserve original enum name with Schema namespace accessor', () => {
    const result = buildFieldType(mockEnumField, mockDMMF);

    // Test 12: Uses namespace pattern EnumName.Schema
    expect(result).toMatch(/^[A-Z_]+\.Schema$/);
    expect(result).toContain('PRODUCT_STATUS');
  });
});
