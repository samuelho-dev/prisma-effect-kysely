import { describe, expect, it } from 'vitest';
import type { GeneratorOptions } from '@prisma/generator-helper';
import {
  parseGeneratorConfig,
  isMultiDomainEnabled,
  isScaffoldingEnabled,
  type GeneratorConfig,
} from '../generator/config';

/**
 * Create mock GeneratorOptions for testing
 */
function createMockOptions(overrides: {
  output?: string | null;
  config?: Record<string, string | string[] | undefined>;
}) {
  return {
    generator: {
      name: 'prisma-effect-kysely',
      provider: { value: 'prisma-effect-kysely', fromEnvVar: null },
      output:
        overrides.output !== undefined
          ? { value: overrides.output as string, fromEnvVar: null }
          : null,
      config: overrides.config || {},
      binaryTargets: [],
      previewFeatures: [],
      sourceFilePath: '',
      isCustomOutput: false,
    },
    dmmf: {
      datamodel: { models: [], enums: [], types: [] },
      schema: { inputObjectTypes: {}, outputObjectTypes: {}, enumTypes: {}, fieldRefTypes: {} },
      mappings: { modelOperations: [], otherOperations: { read: [], write: [] } },
    },
    datasources: [],
    schemaPath: '/test/schema.prisma',
    version: '5.0.0',
    datamodel: '',
  } as unknown as GeneratorOptions;
}

describe('parseGeneratorConfig', () => {
  describe('output validation', () => {
    it('should throw when output is not configured', () => {
      const options = createMockOptions({ output: null });

      expect(() => parseGeneratorConfig(options)).toThrow(
        'Prisma Effect Generator: output path not configured'
      );
    });

    it('should throw when output is empty string', () => {
      const options = createMockOptions({ output: '' });

      // Empty string is falsy, so should throw
      expect(() => parseGeneratorConfig(options)).toThrow(
        'Prisma Effect Generator: output path not configured'
      );
    });

    it('should accept valid output path', () => {
      const options = createMockOptions({ output: './generated' });

      const config = parseGeneratorConfig(options);
      expect(config.output).toBe('./generated');
    });
  });

  describe('multiFileDomains configuration', () => {
    it('should default to false when not specified', () => {
      const options = createMockOptions({ output: './generated' });

      const config = parseGeneratorConfig(options);
      expect(config.multiFileDomains).toBe('false');
    });

    it('should accept "true" value', () => {
      const options = createMockOptions({
        output: './generated',
        config: { multiFileDomains: 'true' },
      });

      const config = parseGeneratorConfig(options);
      expect(config.multiFileDomains).toBe('true');
    });

    it('should accept "false" value', () => {
      const options = createMockOptions({
        output: './generated',
        config: { multiFileDomains: 'false' },
      });

      const config = parseGeneratorConfig(options);
      expect(config.multiFileDomains).toBe('false');
    });

    it('should throw on invalid boolean string', () => {
      const options = createMockOptions({
        output: './generated',
        config: { multiFileDomains: 'yes' },
      });

      expect(() => parseGeneratorConfig(options)).toThrow();
    });
  });

  describe('scaffoldLibraries configuration', () => {
    it('should default to false when not specified', () => {
      const options = createMockOptions({ output: './generated' });

      const config = parseGeneratorConfig(options);
      expect(config.scaffoldLibraries).toBe('false');
    });

    it('should accept "true" value', () => {
      const options = createMockOptions({
        output: './generated',
        config: { scaffoldLibraries: 'true' },
      });

      const config = parseGeneratorConfig(options);
      expect(config.scaffoldLibraries).toBe('true');
    });

    it('should throw on invalid boolean string', () => {
      const options = createMockOptions({
        output: './generated',
        config: { scaffoldLibraries: 'invalid' },
      });

      expect(() => parseGeneratorConfig(options)).toThrow();
    });
  });

  describe('libraryGenerator configuration', () => {
    it('should be undefined when not specified', () => {
      const options = createMockOptions({ output: './generated' });

      const config = parseGeneratorConfig(options);
      expect(config.libraryGenerator).toBeUndefined();
    });

    it('should accept string value', () => {
      const options = createMockOptions({
        output: './generated',
        config: { libraryGenerator: '/path/to/generator' },
      });

      const config = parseGeneratorConfig(options);
      expect(config.libraryGenerator).toBe('/path/to/generator');
    });
  });

  describe('previewFeatures configuration', () => {
    it('should default to empty array when not specified', () => {
      const options = createMockOptions({ output: './generated' });

      const config = parseGeneratorConfig(options);
      expect(config.previewFeatures).toEqual([]);
    });

    it('should accept array value', () => {
      const options = createMockOptions({
        output: './generated',
        config: { previewFeatures: ['feature1', 'feature2'] },
      });

      const config = parseGeneratorConfig(options);
      expect(config.previewFeatures).toEqual(['feature1', 'feature2']);
    });

    it('should parse JSON array string', () => {
      const options = createMockOptions({
        output: './generated',
        config: { previewFeatures: '["feature1", "feature2"]' },
      });

      const config = parseGeneratorConfig(options);
      expect(config.previewFeatures).toEqual(['feature1', 'feature2']);
    });

    it('should parse comma-separated string', () => {
      const options = createMockOptions({
        output: './generated',
        config: { previewFeatures: 'feature1, feature2' },
      });

      const config = parseGeneratorConfig(options);
      expect(config.previewFeatures).toEqual(['feature1', 'feature2']);
    });
  });

  describe('complete configuration', () => {
    it('should parse all configuration options together', () => {
      const options = createMockOptions({
        output: './libs/contracts/generated',
        config: {
          multiFileDomains: 'true',
          scaffoldLibraries: 'true',
          libraryGenerator: '/tools/generator',
          previewFeatures: ['feature1'],
        },
      });

      const config = parseGeneratorConfig(options);

      expect(config).toEqual({
        output: './libs/contracts/generated',
        multiFileDomains: 'true',
        scaffoldLibraries: 'true',
        libraryGenerator: '/tools/generator',
        previewFeatures: ['feature1'],
      });
    });
  });
});

describe('isMultiDomainEnabled', () => {
  it('should return true when multiFileDomains is "true"', () => {
    const config: GeneratorConfig = {
      output: './generated',
      multiFileDomains: 'true',
      scaffoldLibraries: 'false',
      previewFeatures: [],
    };

    expect(isMultiDomainEnabled(config)).toBe(true);
  });

  it('should return false when multiFileDomains is "false"', () => {
    const config: GeneratorConfig = {
      output: './generated',
      multiFileDomains: 'false',
      scaffoldLibraries: 'false',
      previewFeatures: [],
    };

    expect(isMultiDomainEnabled(config)).toBe(false);
  });
});

describe('isScaffoldingEnabled', () => {
  it('should return true when both scaffoldLibraries and multiFileDomains are "true"', () => {
    const config: GeneratorConfig = {
      output: './generated',
      multiFileDomains: 'true',
      scaffoldLibraries: 'true',
      previewFeatures: [],
    };

    expect(isScaffoldingEnabled(config)).toBe(true);
  });

  it('should return false when scaffoldLibraries is "true" but multiFileDomains is "false"', () => {
    const config: GeneratorConfig = {
      output: './generated',
      multiFileDomains: 'false',
      scaffoldLibraries: 'true',
      previewFeatures: [],
    };

    expect(isScaffoldingEnabled(config)).toBe(false);
  });

  it('should return false when scaffoldLibraries is "false"', () => {
    const config: GeneratorConfig = {
      output: './generated',
      multiFileDomains: 'true',
      scaffoldLibraries: 'false',
      previewFeatures: [],
    };

    expect(isScaffoldingEnabled(config)).toBe(false);
  });

  it('should return false when both are "false"', () => {
    const config: GeneratorConfig = {
      output: './generated',
      multiFileDomains: 'false',
      scaffoldLibraries: 'false',
      previewFeatures: [],
    };

    expect(isScaffoldingEnabled(config)).toBe(false);
  });
});
