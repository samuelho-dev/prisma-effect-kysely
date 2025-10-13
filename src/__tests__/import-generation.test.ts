import { EffectGenerator } from '../effect/generator';
import { createMockDMMF, createMockEnum } from './helpers/dmmf-mocks';

describe('generateTypesHeader - Enum Imports', () => {
  const mockDMMF = createMockDMMF({
    enums: [createMockEnum('PRODUCT_STATUS', []), createMockEnum('PRODUCT_TYPE', [])],
    models: [],
  });

  const generator = new EffectGenerator(mockDMMF);

  it('should import only Schema wrappers (not plain enum types)', () => {
    const header = generator.generateTypesHeader(true);

    // Should import Schema wrappers
    expect(header).toContain('ProductStatusSchema');
    expect(header).toContain('ProductTypeSchema');

    // Should NOT import plain enum types (to avoid unused import warnings)
    expect(header).not.toMatch(/\bProductStatus[^S]/); // ProductStatus not followed by 'S' (Schema)
    expect(header).not.toMatch(/\bProductType[^S]/); // ProductType not followed by 'S' (Schema)
  });

  it('should NOT import SCREAMING_SNAKE_CASE names', () => {
    const header = generator.generateTypesHeader(true);

    // Test 15: Old naming pattern not used
    expect(header).not.toContain('PRODUCT_STATUS');
    expect(header).not.toContain('PRODUCT_TYPE');
  });
});
