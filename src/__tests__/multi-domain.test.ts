/**
 * Multi-Domain Generation Tests
 *
 * Tests multi-domain support:
 * 1. Groups Prisma 8 models by contract namespace
 * 2. Generates schemas in separate namespace directories
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DMMF, GeneratorOptions } from '@prisma/generator-helper';
import prismaInternals from '@prisma/internals';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isMultiDomainEnabled, parseGeneratorConfig } from '../generator/config';
import { detectDomains } from '../generator/domain-detector';
import { GeneratorOrchestrator } from '../generator/orchestrator';

const { getDMMF } = prismaInternals;

describe('Multi-Domain Generation', () => {
  const testOutputDir = path.join(import.meta.dirname, 'test-output-multi-domain');

  beforeEach(() => {
    // Clean up test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up after tests
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('Configuration Parsing', () => {
    it('should parse multi-domain configuration correctly', () => {
      const mockOptions: GeneratorOptions = {
        generator: {
          name: 'effectSchemas',
          provider: {
            value: 'prisma-effect-kysely',
            fromEnvVar: null,
          },
          output: {
            value: testOutputDir,
            fromEnvVar: null,
          },
          config: {
            multiFileDomains: 'true',
          },
          binaryTargets: [],
          previewFeatures: [],
          sourceFilePath: '/test/schema.prisma',
        },
        schemaPath: '/test/schema.prisma',
        dmmf: createMockDMMF([]),
        datasources: [],
        datamodel: '',
        version: '1.0.0',
        otherGenerators: [],
      };

      const config = parseGeneratorConfig(mockOptions);

      expect(config.multiFileDomains).toBe('true');
      expect(isMultiDomainEnabled(config)).toBe(true);
    });

    it('should default to single-domain mode when multiFileDomains is false', () => {
      const mockOptions: GeneratorOptions = {
        generator: {
          name: 'effectSchemas',
          provider: {
            value: 'prisma-effect-kysely',
            fromEnvVar: null,
          },
          output: {
            value: testOutputDir,
            fromEnvVar: null,
          },
          config: {
            multiFileDomains: 'false',
          },
          binaryTargets: [],
          previewFeatures: [],
          sourceFilePath: '/test/schema.prisma',
        },
        schemaPath: '/test/schema.prisma',
        dmmf: createMockDMMF([]),
        datasources: [],
        datamodel: '',
        version: '1.0.0',
        otherGenerators: [],
      };

      const config = parseGeneratorConfig(mockOptions);

      expect(config.multiFileDomains).toBe('false');
      expect(isMultiDomainEnabled(config)).toBe(false);
    });

    it('should handle missing config gracefully (backward compatibility)', () => {
      const mockOptions: GeneratorOptions = {
        generator: {
          name: 'effectSchemas',
          provider: {
            value: 'prisma-effect-kysely',
            fromEnvVar: null,
          },
          output: {
            value: testOutputDir,
            fromEnvVar: null,
          },
          config: {},
          binaryTargets: [],
          previewFeatures: [],
          sourceFilePath: '/test/schema.prisma',
        },
        schemaPath: '/test/schema.prisma',
        dmmf: createMockDMMF([]),
        datasources: [],
        datamodel: '',
        version: '1.0.0',
        otherGenerators: [],
      };

      const config = parseGeneratorConfig(mockOptions);

      expect(config.multiFileDomains).toBe('false');
      expect(isMultiDomainEnabled(config)).toBe(false);
    });
  });

  describe('Domain Detection', () => {
    it('should detect domains from model groups', () => {
      const userModel = createMockModel('User', [
        { name: 'id', type: 'String', isId: true },
        { name: 'email', type: 'String' },
      ]);

      const productModel = createMockModel('Product', [
        { name: 'id', type: 'String', isId: true },
        { name: 'name', type: 'String' },
      ]);

      const dmmf = createMockDMMF([userModel, productModel]);

      // With no schema location metadata, should return single "shared" domain
      const domains = detectDomains(dmmf);

      expect(domains).toHaveLength(1);
      expect(domains[0].name).toBe('shared');
      expect(domains[0].models).toHaveLength(2);
    });

    it('should handle empty model list', () => {
      const dmmf = createMockDMMF([]);
      const domains = detectDomains(dmmf);

      expect(domains).toHaveLength(1);
      expect(domains[0].name).toBe('shared');
      expect(domains[0].models).toHaveLength(0);
    });
  });

  describe('Single-Domain Mode (Default Behavior)', () => {
    it('should generate all schemas in single output directory', async () => {
      const userModel = createMockModel('User', [
        { name: 'id', type: 'String', isId: true },
        { name: 'email', type: 'String' },
        { name: 'name', type: 'String' },
      ]);

      const productModel = createMockModel('Product', [
        { name: 'id', type: 'String', isId: true },
        { name: 'name', type: 'String' },
        { name: 'price', type: 'Int' },
      ]);

      const mockOptions: GeneratorOptions = {
        generator: {
          name: 'effectSchemas',
          provider: {
            value: 'prisma-effect-kysely',
            fromEnvVar: null,
          },
          output: {
            value: testOutputDir,
            fromEnvVar: null,
          },
          config: {
            multiFileDomains: 'false',
          },
          binaryTargets: [],
          previewFeatures: [],
          sourceFilePath: '/test/schema.prisma',
        },
        schemaPath: '/test/schema.prisma',
        dmmf: createMockDMMF([userModel, productModel]),
        datasources: [],
        datamodel: '',
        version: '1.0.0',
        otherGenerators: [],
      };

      const orchestrator = new GeneratorOrchestrator(mockOptions);
      await orchestrator.generate(mockOptions);

      // Should generate files in single output directory
      expect(fs.existsSync(path.join(testOutputDir, 'types.ts'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'enums.ts'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'index.ts'))).toBe(true);

      // Should NOT create domain subdirectories
      expect(fs.existsSync(path.join(testOutputDir, 'user'))).toBe(false);
      expect(fs.existsSync(path.join(testOutputDir, 'product'))).toBe(false);

      // Verify both models expose their operation codecs and native tables.
      const typesContent = fs.readFileSync(path.join(testOutputDir, 'types.ts'), 'utf-8');
      for (const model of ['User', 'Product']) {
        expect(typesContent).toContain(`export const ${model} =`);
        expect(typesContent).toContain(`export const ${model}Insert =`);
        expect(typesContent).toContain(`export const ${model}Update =`);
        expect(typesContent).toContain(`export interface ${model}Table`);
      }
    });
  });

  describe('Multi-Domain Mode', () => {
    it('should generate schemas in separate domain directories', async () => {
      // Create mock models that would be in different domains
      const userModel = createMockModel('User', [
        { name: 'id', type: 'String', isId: true },
        { name: 'email', type: 'String' },
      ]);

      const productModel = createMockModel('Product', [
        { name: 'id', type: 'String', isId: true },
        { name: 'name', type: 'String' },
      ]);

      const dmmf = createMockDMMF([userModel, productModel]);
      Object.assign(dmmf.datamodel.models[0], { schema: 'user' });
      Object.assign(dmmf.datamodel.models[1], { schema: 'product' });

      const mockOptions: GeneratorOptions = {
        generator: {
          name: 'effectSchemas',
          provider: {
            value: 'prisma-effect-kysely',
            fromEnvVar: null,
          },
          output: {
            value: testOutputDir,
            fromEnvVar: null,
          },
          config: {
            multiFileDomains: 'true',
          },
          binaryTargets: [],
          previewFeatures: [],
          sourceFilePath: '/test/schema.prisma',
        },
        schemaPath: '/test/schema.prisma',
        dmmf,
        datasources: [],
        datamodel: '',
        version: '1.0.0',
        otherGenerators: [],
      };

      const orchestrator = new GeneratorOrchestrator(mockOptions);
      await orchestrator.generate(mockOptions);

      // Should create domain directories
      expect(fs.existsSync(path.join(testOutputDir, 'user/src/generated'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'product/src/generated'))).toBe(true);

      // Should generate types.ts in each domain
      expect(fs.existsSync(path.join(testOutputDir, 'user/src/generated/types.ts'))).toBe(true);
      expect(fs.existsSync(path.join(testOutputDir, 'product/src/generated/types.ts'))).toBe(true);

      // Each domain exports only its own operation codecs and native table interface.
      const userTypesContent = fs.readFileSync(
        path.join(testOutputDir, 'user/src/generated/types.ts'),
        'utf-8'
      );
      const productTypesContent = fs.readFileSync(
        path.join(testOutputDir, 'product/src/generated/types.ts'),
        'utf-8'
      );

      for (const model of ['User', 'Product']) {
        const domainTypesContent = model === 'User' ? userTypesContent : productTypesContent;
        const otherModel = model === 'User' ? 'Product' : 'User';

        expect(domainTypesContent).toContain(`export const ${model} =`);
        expect(domainTypesContent).toContain(`export const ${model}Insert =`);
        expect(domainTypesContent).toContain(`export const ${model}Update =`);
        expect(domainTypesContent).toContain(`export interface ${model}Table`);
        expect(domainTypesContent).not.toContain(`export const ${otherModel} =`);
        expect(domainTypesContent).not.toContain(`export const ${otherModel}Insert =`);
        expect(domainTypesContent).not.toContain(`export const ${otherModel}Update =`);
        expect(domainTypesContent).not.toContain(`export interface ${otherModel}Table`);
      }
    });
    it('compiles enum-free domain barrels with cross-domain foreign keys', async () => {
      const dmmf = await getDMMF({
        datamodel: `
          datasource db {
            provider = "postgresql"
          }

          model User {
            id    String @id @db.Uuid
            posts Post[]
          }

          model Post {
            id      String @id @db.Uuid
            ownerId String @db.Uuid @map("owner_id")
            owner   User   @relation(fields: [ownerId], references: [id])
          }
        `,
      });
      const user = dmmf.datamodel.models.find((model) => model.name === 'User');
      const post = dmmf.datamodel.models.find((model) => model.name === 'Post');
      if (!user || !post) {
        throw new Error('Expected User and Post models');
      }
      Object.assign(user, { schema: 'identity' });
      Object.assign(post, { schema: 'content' });

      const options = {
        generator: {
          output: { value: testOutputDir },
          config: { multiFileDomains: 'true' },
        },
        dmmf,
      } as GeneratorOptions;
      await new GeneratorOrchestrator(options).generate(options);

      const consumerPath = path.join(testOutputDir, 'domain-contract.ts');
      const tsconfigPath = path.join(testOutputDir, 'tsconfig.json');
      fs.writeFileSync(
        consumerPath,
        `import type { Post, UserId } from "./content/src/generated/index.ts";

type Assert<T extends true> = T;
type PostOwnerUsesGlobalBrand = Assert<Post["ownerId"] extends UserId ? true : false>;
`
      );
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          extends: path.join(process.cwd(), 'tsconfig.json'),
          compilerOptions: {
            noEmit: true,
            allowImportingTsExtensions: true,
            types: ['node'],
          },
          include: [
            './content/src/generated/**/*.ts',
            './identity/src/generated/**/*.ts',
            './domain-contract.ts',
          ],
        })
      );

      expect(fs.existsSync(path.join(testOutputDir, 'content/src/generated/enums.ts'))).toBe(true);
      execFileSync('./node_modules/.bin/tsc', ['--noEmit', '-p', tsconfigPath], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
    });

    it('keeps colliding physical table keys bare inside separate domains', async () => {
      const dmmf = await getDMMF({
        datamodel: `
          datasource db {
            provider = "postgresql"
          }

          model PublicUser {
            id String @id @db.Uuid
          }

          model AuditUser {
            id String @id @db.Uuid
          }
        `,
      });
      for (const [name, schema] of [
        ['PublicUser', 'public'],
        ['AuditUser', 'audit'],
      ] as const) {
        const model = dmmf.datamodel.models.find((candidate) => candidate.name === name);
        if (!model) throw new Error(`Expected ${name} model`);
        Object.assign(model, { dbName: 'user', schema });
      }

      const options = {
        generator: {
          output: { value: testOutputDir },
          config: { multiFileDomains: 'true' },
        },
        dmmf,
      } as GeneratorOptions;
      await new GeneratorOrchestrator(options).generate(options);

      const consumerPath = path.join(testOutputDir, 'domain-table-contract.ts');
      const tsconfigPath = path.join(testOutputDir, 'tsconfig.json');
      fs.writeFileSync(
        consumerPath,
        `import type { DB as AuditDB } from "./audit/src/generated/index.ts";
import type { DB as PublicDB } from "./public/src/generated/index.ts";

type Assert<T extends true> = T;
type AuditTableIsBare = Assert<"user" extends keyof AuditDB ? true : false>;
type PublicTableIsBare = Assert<"user" extends keyof PublicDB ? true : false>;
type AuditTableIsNotQualified = Assert<"audit.user" extends keyof AuditDB ? false : true>;
type PublicTableIsNotQualified = Assert<"public.user" extends keyof PublicDB ? false : true>;
`
      );
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          extends: path.join(process.cwd(), 'tsconfig.json'),
          compilerOptions: {
            noEmit: true,
            allowImportingTsExtensions: true,
            types: ['node'],
          },
          include: [
            './audit/src/generated/**/*.ts',
            './public/src/generated/**/*.ts',
            './domain-table-contract.ts',
          ],
        })
      );

      const compilerOutput = execFileSync(
        './node_modules/.bin/tsc',
        ['--noEmit', '-p', tsconfigPath],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        }
      );
      expect(compilerOutput).toBe('');
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function createMockDMMF(models: DMMF.Model[]) {
  return {
    datamodel: {
      models,
      enums: [],
      types: [],
      indexes: [],
    },
    schema: {
      inputObjectTypes: {
        prisma: [],
        model: undefined,
      },
      outputObjectTypes: {
        prisma: [],
        model: [],
      },
      enumTypes: {
        prisma: [],
        model: undefined,
      },
      fieldRefTypes: {
        prisma: undefined,
      },
    },
    mappings: {
      modelOperations: [],
      otherOperations: {
        read: [],
        write: [],
      },
    },
  };
}

interface MockField {
  name: string;
  type: string;
  isId?: boolean;
  isRequired?: boolean;
  isList?: boolean;
}

function createMockModel(name: string, mockFields: MockField[]) {
  const fields: DMMF.Field[] = mockFields.map((f) => ({
    name: f.name,
    kind: 'scalar' as const,
    isList: f.isList ?? false,
    isRequired: f.isRequired ?? true,
    isUnique: false,
    isId: f.isId ?? false,
    isReadOnly: false,
    hasDefaultValue: false,
    type: f.type,
    isGenerated: false,
    isUpdatedAt: false,
  }));

  return {
    name,
    dbName: null,
    schema: null,
    fields,
    uniqueFields: [],
    uniqueIndexes: [],
    primaryKey: null,
  } as DMMF.Model;
}
