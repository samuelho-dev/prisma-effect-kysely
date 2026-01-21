import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { DMMF } from '@prisma/generator-helper';
import {
  detectDomains,
  getDomainNames,
  getModelsForDomain,
  type DomainInfo,
} from '../generator/domain-detector';
import { createMockDMMF, createMockModel } from './helpers/dmmf-mocks';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import * as fs from 'node:fs';

/**
 * Helper to add schemaLocation metadata to a model for domain detection tests.
 * This property is added by Prisma internally but not in the public DMMF types.
 */
function withSchemaLocation(model: DMMF.Model, schemaLocation: string) {
  (model as unknown as Record<string, unknown>).schemaLocation = schemaLocation;
  return model;
}

describe('detectDomains', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fallback behavior', () => {
    it('should return single "shared" domain when no domain info available', () => {
      const models = [createMockModel({ name: 'User' }), createMockModel({ name: 'Post' })];
      const dmmf = createMockDMMF({ models });

      // Mock fs to return false for existsSync
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const domains = detectDomains(dmmf);

      expect(domains).toHaveLength(1);
      expect(domains[0].name).toBe('shared');
      expect(domains[0].models).toHaveLength(2);
      expect(domains[0].models[0].name).toBe('User');
      expect(domains[0].models[1].name).toBe('Post');
    });

    it('should return single "shared" domain when schemaPath not provided', () => {
      const models = [createMockModel({ name: 'User' })];
      const dmmf = createMockDMMF({ models });

      const domains = detectDomains(dmmf);

      expect(domains).toHaveLength(1);
      expect(domains[0].name).toBe('shared');
    });
  });

  describe('DMMF-based detection (Strategy 1)', () => {
    it('should detect domains from schema location metadata', () => {
      const models = [
        withSchemaLocation(createMockModel({ name: 'User' }), 'prisma/schemas/user.prisma'),
        withSchemaLocation(createMockModel({ name: 'UserProfile' }), 'prisma/schemas/user.prisma'),
        withSchemaLocation(createMockModel({ name: 'Product' }), 'prisma/schemas/product.prisma'),
      ];
      const dmmf = createMockDMMF({ models });

      const domains = detectDomains(dmmf);

      expect(domains).toHaveLength(2);

      const userDomain = domains.find((d) => d.name === 'user');
      const productDomain = domains.find((d) => d.name === 'product');

      expect(userDomain).toBeDefined();
      expect(userDomain?.models).toHaveLength(2);
      expect(userDomain?.models.map((m) => m.name)).toEqual(['User', 'UserProfile']);

      expect(productDomain).toBeDefined();
      expect(productDomain?.models).toHaveLength(1);
      expect(productDomain?.models[0].name).toBe('Product');
    });

    it('should handle models without schema location', () => {
      const models = [
        withSchemaLocation(createMockModel({ name: 'User' }), 'prisma/schemas/user.prisma'),
        createMockModel({ name: 'Config' }), // No schema location
      ];
      const dmmf = createMockDMMF({ models });

      // Mock fs to not find schemas directory
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const domains = detectDomains(dmmf);

      // Should find user domain from DMMF, but Config goes to shared
      expect(domains).toHaveLength(1);
      expect(domains[0].name).toBe('user');
      expect(domains[0].models).toHaveLength(1);
    });

    it('should extract domain name from nested paths', () => {
      const models = [
        withSchemaLocation(
          createMockModel({ name: 'Order' }),
          'libs/contracts/prisma/schemas/order.prisma'
        ),
      ];
      const dmmf = createMockDMMF({ models });

      const domains = detectDomains(dmmf);

      expect(domains).toHaveLength(1);
      expect(domains[0].name).toBe('order');
    });
  });

  describe('file-based detection (Strategy 2)', () => {
    it('should detect domains from schema files in prisma/schemas/', () => {
      const models = [createMockModel({ name: 'User' }), createMockModel({ name: 'Product' })];
      const dmmf = createMockDMMF({ models });

      // Mock fs to find schemas directory with files
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'user.prisma',
        'product.prisma',
      ] as unknown as ReturnType<typeof fs.readdirSync>);

      const domains = detectDomains(dmmf, '/project/prisma/schema.prisma');

      expect(domains).toHaveLength(2);
      expect(getDomainNames(domains)).toContain('user');
      expect(getDomainNames(domains)).toContain('product');
    });

    it('should match models to domains by prefix', () => {
      const models = [
        createMockModel({ name: 'UserProfile' }),
        createMockModel({ name: 'UserSettings' }),
        createMockModel({ name: 'ProductCategory' }),
      ];
      const dmmf = createMockDMMF({ models });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'user.prisma',
        'product.prisma',
      ] as unknown as ReturnType<typeof fs.readdirSync>);

      const domains = detectDomains(dmmf, '/project/prisma/schema.prisma');

      const userDomain = domains.find((d) => d.name === 'user');
      const productDomain = domains.find((d) => d.name === 'product');

      expect(userDomain?.models.map((m) => m.name)).toEqual(['UserProfile', 'UserSettings']);
      expect(productDomain?.models.map((m) => m.name)).toEqual(['ProductCategory']);
    });

    it('should return empty array when schemas directory does not exist', () => {
      const models = [createMockModel({ name: 'User' })];
      const dmmf = createMockDMMF({ models });

      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Should fall back to shared
      const domains = detectDomains(dmmf, '/project/prisma/schema.prisma');

      expect(domains).toHaveLength(1);
      expect(domains[0].name).toBe('shared');
    });

    it('should return empty array when no .prisma files found', () => {
      const models = [createMockModel({ name: 'User' })];
      const dmmf = createMockDMMF({ models });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'README.md',
        'config.json',
      ] as unknown as ReturnType<typeof fs.readdirSync>);

      // Should fall back to shared
      const domains = detectDomains(dmmf, '/project/prisma/schema.prisma');

      expect(domains).toHaveLength(1);
      expect(domains[0].name).toBe('shared');
    });
  });

  describe('empty models', () => {
    it('should handle empty models array', () => {
      const dmmf = createMockDMMF({ models: [] });

      const domains = detectDomains(dmmf);

      expect(domains).toHaveLength(1);
      expect(domains[0].name).toBe('shared');
      expect(domains[0].models).toHaveLength(0);
    });
  });
});

describe('getDomainNames', () => {
  it('should return array of domain names', () => {
    const domains: DomainInfo[] = [
      { name: 'user', models: [] },
      { name: 'product', models: [] },
      { name: 'order', models: [] },
    ];

    const names = getDomainNames(domains);

    expect(names).toEqual(['user', 'product', 'order']);
  });

  it('should return empty array for empty domains', () => {
    const names = getDomainNames([]);

    expect(names).toEqual([]);
  });
});

describe('getModelsForDomain', () => {
  it('should return models for specified domain', () => {
    const userModel = createMockModel({ name: 'User' });
    const productModel = createMockModel({ name: 'Product' });

    const domains: DomainInfo[] = [
      { name: 'user', models: [userModel] },
      { name: 'product', models: [productModel] },
    ];

    const userModels = getModelsForDomain(domains, 'user');
    const productModels = getModelsForDomain(domains, 'product');

    expect(userModels).toHaveLength(1);
    expect(userModels[0].name).toBe('User');

    expect(productModels).toHaveLength(1);
    expect(productModels[0].name).toBe('Product');
  });

  it('should return empty array for non-existent domain', () => {
    const domains: DomainInfo[] = [{ name: 'user', models: [createMockModel({ name: 'User' })] }];

    const models = getModelsForDomain(domains, 'nonexistent');

    expect(models).toEqual([]);
  });

  it('should return empty array for empty domains', () => {
    const models = getModelsForDomain([], 'user');

    expect(models).toEqual([]);
  });
});
