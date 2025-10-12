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

  it('should import enums with suffix pattern', () => {
    const header = generator.generateTypesHeader(true);

    // Suffix pattern: import enum + schema separately
    expect(header).toContain('PRODUCT_STATUS');
    expect(header).toContain('PRODUCT_TYPE');

    // Should import Schema exports with suffix
    expect(header).toContain('PRODUCT_STATUSSchema');
    expect(header).toContain('PRODUCT_TYPESchema');
  });

  it('should use standard Effect import', () => {
    const header = generator.generateTypesHeader(true);

    // Should use import { Schema } from 'effect'
    expect(header).toContain('import { Schema } from "effect"');
    expect(header).not.toContain('import * as Effect from "effect"');
  });
});
