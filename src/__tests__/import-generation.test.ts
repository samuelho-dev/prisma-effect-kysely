import { EffectGenerator } from '../effect/generator';
import { createMockDMMF, createMockEnum } from './helpers/dmmf-mocks';

describe('generateTypesHeader - Enum Imports', () => {
  const mockDMMF = createMockDMMF({
    enums: [
      createMockEnum('PRODUCT_STATUS', []),
      createMockEnum('PRODUCT_TYPE', [])
    ],
    models: []
  });

  const generator = new EffectGenerator(mockDMMF);

  it('should import both enum and Schema wrapper', () => {
    const header = generator.generateTypesHeader(true);

    // Test 13: Imports enum name
    expect(header).toContain('ProductStatus');
    expect(header).toContain('ProductType');

    // Test 14: Imports Schema wrappers
    expect(header).toContain('ProductStatusSchema');
    expect(header).toContain('ProductTypeSchema');
  });

  it('should NOT import SCREAMING_SNAKE_CASE names', () => {
    const header = generator.generateTypesHeader(true);

    // Test 15: Old naming pattern not used
    expect(header).not.toContain('PRODUCT_STATUS');
    expect(header).not.toContain('PRODUCT_TYPE');
  });
});
