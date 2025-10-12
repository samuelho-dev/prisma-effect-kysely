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

  it('should import enums with original names (namespace pattern)', () => {
    const header = generator.generateTypesHeader(true);

    // With namespace pattern (v1.6.0+), we only import the enum itself
    // Access Schema through namespace: EnumName.Schema
    expect(header).toContain('PRODUCT_STATUS');
    expect(header).toContain('PRODUCT_TYPE');

    // Should NOT import separate Schema exports (old pattern)
    expect(header).not.toContain('ProductStatusSchema');
    expect(header).not.toContain('ProductTypeSchema');
  });

  it('should use Effect import pattern', () => {
    const header = generator.generateTypesHeader(true);

    // Should use import * as Effect from 'effect'
    expect(header).toContain('import * as Effect from "effect"');
    expect(header).not.toContain('import { Schema } from "effect"');
  });
});
