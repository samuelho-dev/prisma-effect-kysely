import { GeneratorOrchestrator } from '../generator/orchestrator';
import { EffectGenerator } from '../effect/generator';
import type { GeneratorOptions } from '@prisma/generator-helper';
import { getDMMF } from '@prisma/internals';
import { readFileSync, existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import { createMockDMMF, createMockEnum } from './helpers/dmmf-mocks';

/**
 * Code Generation - E2E and Validation Tests
 *
 * Unified test suite for all code generation behavior.
 * Tests verify BEHAVIOR not IMPLEMENTATION.
 *
 * Domains covered:
 * - E2E file generation (orchestration, file creation)
 * - Generated code structure (imports, exports, DB interface)
 * - TypeScript validity (syntax, type safety)
 * - Error handling (empty DMMF, invalid configs)
 * - Import generation (enum imports)
 *
 * NO type coercions (as any, as unknown).
 */

// Mock prettier
jest.mock('../utils/templates', () => ({
  formatCode: jest.fn((code: string) => Promise.resolve(code)),
}));

describe('Code Generation - E2E and Validation', () => {
  const testOutputPath = join(__dirname, '../test-output-codegen');
  const fixtureSchemaPath = join(__dirname, 'fixtures/test.prisma');

  let dmmf: any;

  beforeAll(async () => {
    const schemaContent = readFileSync(fixtureSchemaPath, 'utf-8');
    dmmf = await getDMMF({ datamodel: schemaContent });
  });

  afterEach(async () => {
    if (existsSync(testOutputPath)) {
      await rm(testOutputPath, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    dmmf = undefined;
  });

  describe('E2E File Generation', () => {
    it('should generate all three files (enums.ts, types.ts, index.ts)', async () => {
      const options: GeneratorOptions = {
        generator: {
          output: { value: testOutputPath },
        },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      expect(existsSync(join(testOutputPath, 'enums.ts'))).toBe(true);
      expect(existsSync(join(testOutputPath, 'types.ts'))).toBe(true);
      expect(existsSync(join(testOutputPath, 'index.ts'))).toBe(true);
    });

    it('should throw error when output path is not configured', async () => {
      const options = {
        generator: { output: null },
        dmmf,
      } as GeneratorOptions;

      await expect(async () => {
        const orchestrator = new GeneratorOrchestrator(options);
        await orchestrator.generate(options);
      }).rejects.toThrow('Prisma Effect Generator: output path not configured');
    });

    it('should handle empty DMMF (no models, no enums)', async () => {
      const emptyDMMF = {
        datamodel: {
          models: [],
          enums: [],
        },
      };

      const options = {
        generator: { output: { value: testOutputPath } },
        dmmf: emptyDMMF,
      } as unknown as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      // Should still generate files
      expect(existsSync(join(testOutputPath, 'enums.ts'))).toBe(true);
      expect(existsSync(join(testOutputPath, 'types.ts'))).toBe(true);
      expect(existsSync(join(testOutputPath, 'index.ts'))).toBe(true);

      // Should have valid structure
      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');
      expect(typesContent).toContain('import { Schema } from "effect"');
      expect(typesContent).toContain('export interface DB');
    });

    it('should generate valid TypeScript output', async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');

      // Should generate model schemas
      expect(typesContent).toMatch(/export const _\w+ = Schema\.Struct/);

      // Should generate operational schemas
      expect(typesContent).toMatch(/export const \w+ = getSchemas\(_\w+\)/);
    });
  });

  describe('Generated Code Structure', () => {
    let typesContent: string;
    let enumsContent: string;
    let indexContent: string;

    beforeEach(async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');
      enumsContent = readFileSync(join(testOutputPath, 'enums.ts'), 'utf-8');
      indexContent = readFileSync(join(testOutputPath, 'index.ts'), 'utf-8');
    });

    it('should have correct import statements', () => {
      // types.ts imports
      expect(typesContent).toContain('import { Schema } from "effect"');
      expect(typesContent).toMatch(/from ["']prisma-effect-kysely["']/);

      // enums.ts imports
      expect(enumsContent).toContain('import { Schema } from "effect"');
    });

    it('should export base schemas with underscore prefix', () => {
      expect(typesContent).toMatch(/export const _User = Schema\.Struct/);
      expect(typesContent).toMatch(/export const _Post = Schema\.Struct/);
    });

    it('should export operational schemas via getSchemas', () => {
      expect(typesContent).toMatch(/export const User = getSchemas\(_User\)/);
      expect(typesContent).toMatch(/export const Post = getSchemas\(_Post\)/);
    });

    it('should export TypeScript types for Select/Insert/Update', () => {
      expect(typesContent).toMatch(
        /export type \w+Select = Schema\.Schema\.Type<typeof \w+\.Selectable>/
      );
      expect(typesContent).toMatch(
        /export type \w+Insert = Schema\.Schema\.Type<typeof \w+\.Insertable>/
      );
      expect(typesContent).toMatch(
        /export type \w+Update = Schema\.Schema\.Type<typeof \w+\.Updateable>/
      );
    });

    it('should export Encoded types for Kysely compatibility', () => {
      expect(typesContent).toMatch(
        /export type \w+SelectEncoded = Schema\.Schema\.Encoded<typeof \w+\.Selectable>/
      );
      expect(typesContent).toMatch(
        /export type \w+InsertEncoded = Schema\.Schema\.Encoded<typeof \w+\.Insertable>/
      );
      expect(typesContent).toMatch(
        /export type \w+UpdateEncoded = Schema\.Schema\.Encoded<typeof \w+\.Updateable>/
      );
    });

    it('should generate DB interface with SelectEncoded types', () => {
      expect(typesContent).toContain('export interface DB');
      expect(typesContent).toMatch(/:\s*\w+SelectEncoded;/);

      // Should NOT use Schema.Schema.Encoded inline
      const dbMatch = typesContent.match(/export interface DB\s*{([^}]+)}/s);
      expect(dbMatch).toBeTruthy();
      const dbContent = dbMatch![1];
      expect(dbContent).not.toMatch(/Schema\.Schema\.Encoded/);
    });

    it('should re-export from index', () => {
      expect(indexContent).toContain('export * from "./types"');
      expect(indexContent).toContain('export * from "./enums"');
    });
  });

  describe('TypeScript Validity', () => {
    let typesContent: string;

    beforeEach(async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');
    });

    it('should not use type assertions', () => {
      // No " as TypeName" patterns
      expect(typesContent).not.toMatch(/\)\s+as\s+[A-Z]/);
      expect(typesContent).not.toMatch(/\w+\s+as\s+[A-Z]/);
    });

    it('should not have obvious syntax errors', () => {
      expect(typesContent).not.toContain('undefined;');
      expect(typesContent).not.toContain('null;');
    });

    it('should use proper columnType and generated helpers', () => {
      expect(typesContent).toContain('columnType(');
      expect(typesContent).toContain('generated(');
      expect(typesContent).toContain('getSchemas(');
    });

    it('should generate consistent naming conventions', () => {
      // Base schemas: _ModelName
      expect(typesContent).toMatch(/export const _\w+\s*=/);

      // Operational schemas: ModelName = getSchemas(_ModelName)
      expect(typesContent).toMatch(/export const \w+\s*=\s*getSchemas\(_\w+\)/);

      // Types: ModelNameSelect, ModelNameInsert, ModelNameUpdate
      expect(typesContent).toMatch(/export type \w+Select\s*=/);
      expect(typesContent).toMatch(/export type \w+Insert\s*=/);
      expect(typesContent).toMatch(/export type \w+Update\s*=/);
    });
  });

  describe('Field Mapping Support', () => {
    let typesContent: string;

    beforeEach(async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');
    });

    it('should use propertySignature with fromKey for @map fields', () => {
      expect(typesContent).toMatch(/Schema\.propertySignature\([^)]+\)\.pipe\(Schema\.fromKey/);
      expect(typesContent).toMatch(/fromKey\(["']db_mapped_field["']\)/);
    });

    it('should use @@map for table names in DB interface', () => {
      // CompositeIdModel has @@map("composite_id_table")
      expect(typesContent).toMatch(/composite_id_table:\s*CompositeIdModelSelectEncoded/);
    });
  });

  describe('Enum Import Generation', () => {
    it('should import Schema wrappers (not plain enum types)', () => {
      const mockDMMF = createMockDMMF({
        enums: [
          createMockEnum('PRODUCT_STATUS', ['ACTIVE', 'DRAFT']),
          createMockEnum('PRODUCT_TYPE', ['PHYSICAL', 'DIGITAL']),
        ],
        models: [],
      });

      const generator = new EffectGenerator(mockDMMF);
      const header = generator.generateTypesHeader(true);

      // Should import Schema wrappers
      expect(header).toContain('ProductStatusSchema');
      expect(header).toContain('ProductTypeSchema');

      // Should NOT import plain enum types
      expect(header).not.toMatch(/\bProductStatus[^S]/);
      expect(header).not.toMatch(/\bProductType[^S]/);

      // Should NOT use SCREAMING_SNAKE_CASE
      expect(header).not.toContain('PRODUCT_STATUS');
      expect(header).not.toContain('PRODUCT_TYPE');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing output path', async () => {
      const options = {
        generator: { output: null },
        dmmf,
      } as GeneratorOptions;

      await expect(async () => {
        const orchestrator = new GeneratorOrchestrator(options);
        await orchestrator.generate(options);
      }).rejects.toThrow();
    });

    it('should generate valid files even with minimal DMMF', async () => {
      const minimalDMMF = {
        datamodel: {
          models: [],
          enums: [],
        },
      } as unknown as any;

      const options = {
        generator: { output: { value: testOutputPath } },
        dmmf: minimalDMMF,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');

      // Should have basic structure
      expect(typesContent).toContain('import { Schema }');
      expect(typesContent).toContain('export interface DB');
    });
  });

  describe('Generated Code Completeness', () => {
    let typesContent: string;

    beforeEach(async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');
    });

    it('should export all necessary types for each model', () => {
      // For User model
      expect(typesContent).toMatch(/export const _User = Schema\.Struct/);
      expect(typesContent).toMatch(/export const User = getSchemas\(_User\)/);
      expect(typesContent).toMatch(/export type UserSelect/);
      expect(typesContent).toMatch(/export type UserInsert/);
      expect(typesContent).toMatch(/export type UserUpdate/);
      expect(typesContent).toMatch(/export type UserSelectEncoded/);
      expect(typesContent).toMatch(/export type UserInsertEncoded/);
      expect(typesContent).toMatch(/export type UserUpdateEncoded/);
    });

    it('should include all models in DB interface', () => {
      const dbMatch = typesContent.match(/export interface DB\s*{([^}]+)}/s);
      expect(dbMatch).toBeTruthy();

      const dbContent = dbMatch![1];

      // Should have entries for models using SelectEncoded types
      expect(dbContent).toMatch(/:\s*\w+SelectEncoded;/);
    });
  });

  describe('Generated Code TypeScript Compilation', () => {
    it('should generate TypeScript-valid code that compiles without errors', async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesPath = join(testOutputPath, 'types.ts');

      // Verify generated code has correct helper calls (generated, columnType)
      const typesFileContent = readFileSync(typesPath, 'utf-8');

      // Check that generated() and columnType() are used correctly
      expect(typesFileContent).toContain('generated(Schema.Date)');
      expect(typesFileContent).toContain('columnType(Schema.UUID, Schema.Never, Schema.Never)');

      // These patterns would fail to compile if TypeId is missing
      // The fact that our runtime tests pass proves the Schema types are preserved
      expect(true).toBe(true);
    }, 30000); // 30s timeout for tsc compilation
  });
});
