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

  it('should map enum field to Schema wrapper (not raw enum)', () => {
    const result = buildFieldType(mockEnumField, mockDMMF);

    // Test 11: Returns Schema wrapper, not enum name
    expect(result).toBe('ProductStatusSchema');
    expect(result).not.toBe('ProductStatus');
    expect(result).not.toBe('PRODUCT_STATUS');
  });

  it('should use PascalCase + Schema suffix', () => {
    const result = buildFieldType(mockEnumField, mockDMMF);

    // Test 12: Naming convention
    expect(result).toMatch(/^[A-Z][a-zA-Z]+Schema$/);
  });
});
