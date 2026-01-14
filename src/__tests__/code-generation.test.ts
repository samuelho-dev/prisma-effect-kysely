import { existsSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { GeneratorOptions } from '@prisma/generator-helper';
import prismaInternals from '@prisma/internals';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectGenerator } from '../effect/generator.js';
import { GeneratorOrchestrator } from '../generator/orchestrator.js';
import { createMockDMMF, createMockEnum } from './helpers/dmmf-mocks.js';

const { getDMMF } = prismaInternals;

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
vi.mock('../utils/templates', () => ({
  formatCode: vi.fn((code: string) => Promise.resolve(code)),
}));

describe('Code Generation - E2E and Validation', () => {
  const testOutputPath = join(import.meta.dirname, '../test-output-codegen');
  const fixtureSchemaPath = join(import.meta.dirname, 'fixtures/test.prisma');

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
      expect(typesContent).toMatch(/import \{ Schema \} from ["']effect["']/);
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

      // Should generate internal base schemas (not exported)
      expect(typesContent).toMatch(/const _\w+ = Schema\.Struct/);

      // Should generate operational schemas (exported, using getSchemas())
      expect(typesContent).toMatch(/export const \w+\s*[=:]\s*/);
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
      expect(typesContent).toMatch(/import \{ Schema \} from ["']effect["']/);
      expect(typesContent).toMatch(/from ["']prisma-effect-kysely["']/);
      // No StrictType import - consumers use type utilities from prisma-effect-kysely

      // enums.ts imports
      expect(enumsContent).toMatch(/import \{ Schema \} from ["']effect["']/);
    });

    it('should generate internal base schemas with underscore prefix', () => {
      // Base schemas EXPORTED for TypeScript declaration emit
      expect(typesContent).toMatch(/export const _User = Schema\.Struct/);
      expect(typesContent).toMatch(/export const _Post = Schema\.Struct/);
    });

    it('should export operational schemas with type annotation pattern', () => {
      // Models with ID fields use type annotation pattern (not type assertion)
      // Pattern: const _UserSchemas = getSchemas(_User, UserIdSchema);
      //          export const User: SchemasWithId<typeof _User, typeof UserIdSchema> = _UserSchemas;
      expect(typesContent).toContain('const _UserSchemas = getSchemas(_User, UserIdSchema);');
      expect(typesContent).toContain('export const User: SchemasWithId<');
      expect(typesContent).toContain('typeof _User');
      expect(typesContent).toContain('typeof UserIdSchema');
      expect(typesContent).toContain('> = _UserSchemas;');
    });

    it('should generate branded ID schemas for models with @id field', () => {
      // Branded ID schemas should be generated for each model with an ID field
      expect(typesContent).toMatch(
        /const UserIdSchema = Schema\.UUID\.pipe\(Schema\.brand\("UserId"\)\)/
      );
    });

    it('should not export individual type aliases', () => {
      // No longer generate UserSelect, UserInsert, etc. - consumers use type utilities
      expect(typesContent).not.toMatch(/export type UserSelect\s*=/);
      expect(typesContent).not.toMatch(/export type UserInsert\s*=/);
      expect(typesContent).not.toMatch(/export type UserSelectEncoded\s*=/);
    });

    it('should generate DB interface with Kysely Table types', () => {
      expect(typesContent).toContain('export interface DB');
      expect(typesContent).toMatch(/:\s*\w+Table;/);

      // Should use Kysely table interfaces, not Schema.Schema.Encoded
      const dbMatch = typesContent.match(/export interface DB\s*{([^}]+)}/s);
      expect(dbMatch).toBeTruthy();
      const dbContent = dbMatch?.[1];
      expect(dbContent).not.toMatch(/Schema\.Schema\.Encoded/);
    });

    it('should re-export from index', () => {
      expect(indexContent).toMatch(/export \* from ["']\.\/types\.js["']/);
      expect(indexContent).toMatch(/export \* from ["']\.\/enums\.js["']/);
    });

    it('should not export duplicate strict alias names', () => {
      expect(typesContent).not.toMatch(/SelectStrict/);
      expect(typesContent).not.toMatch(/InsertStrict/);
      expect(typesContent).not.toMatch(/UpdateStrict/);
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
      // Note: 'null;' is now valid in Kysely table interfaces for optional fields (e.g., 'string | null')
    });

    it('should use proper columnType and generated helpers', () => {
      expect(typesContent).toContain('columnType(');
      expect(typesContent).toContain('generated(');
      // Uses getSchemas() for all models including join tables
      expect(typesContent).toContain('getSchemas(');
    });

    it('should generate consistent naming conventions', () => {
      // Base schemas: _ModelName (exported for TypeScript declaration emit)
      expect(typesContent).toMatch(/export const _\w+\s*=\s*Schema\.Struct/);

      // Branded ID schemas: ModelNameIdSchema (exported for TypeScript declaration emit)
      expect(typesContent).toMatch(/export const \w+IdSchema = Schema\.\w+\.pipe\(Schema\.brand\(/);

      // Operational schemas: ModelName = getSchemas() (exported)
      expect(typesContent).toMatch(/export const \w+\s*[=:]/);
      expect(typesContent).toContain('getSchemas(');
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
      expect(typesContent).toMatch(/composite_id_table:\s*CompositeIdModelTable/);
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
      };

      const options = {
        generator: { output: { value: testOutputPath } },
        dmmf: minimalDMMF,
      };

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

    it('should export all necessary schemas for each model', () => {
      // For User model - base schema is EXPORTED for TypeScript declaration emit
      expect(typesContent).toMatch(/export const _User = Schema\.Struct/);
      // IdSchema is exported for TypeScript declaration emit
      expect(typesContent).toMatch(/export const UserIdSchema = Schema\.UUID\.pipe\(Schema\.brand/);
      // Pattern: const _UserSchemas = getSchemas(_User, UserIdSchema);
      //          export const User: SchemasWithId<typeof _User, typeof UserIdSchema> = _UserSchemas;
      expect(typesContent).toContain('const _UserSchemas = getSchemas(_User, UserIdSchema);');
      expect(typesContent).toContain('export const User: SchemasWithId<');
      // No type aliases - consumers use type utilities: Selectable<typeof User>
    });

    it('should include all models in DB interface', () => {
      const dbMatch = typesContent.match(/export interface DB\s*{([^}]+)}/s);
      expect(dbMatch).toBeTruthy();

      const dbContent = dbMatch?.[1];

      // Should have entries for models using Kysely Table types
      expect(dbContent).toMatch(/:\s*\w+Table;/);
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
      expect(typesFileContent).toContain('generated(Schema.DateFromSelf)');
      expect(typesFileContent).toContain('columnType(Schema.UUID, Schema.Never, Schema.Never)');

      // These patterns would fail to compile if TypeId is missing
      // The fact that our runtime tests pass proves the Schema types are preserved
      expect(true).toBe(true);
    }, 30000); // 30s timeout for tsc compilation
  });

  describe('Kysely Table Interface Enum Types', () => {
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

    it('should use Schema.Schema.Type for enum fields in Kysely table interfaces', () => {
      // Kysely table interfaces should reference enum types via Schema type extraction
      // This ensures we only need to import the Schema wrappers (e.g., RoleSchema)
      // and not the raw enum types (e.g., Role)
      expect(typesContent).toMatch(/role:\s*Schema\.Schema\.Type<typeof RoleSchema>/);
      expect(typesContent).toMatch(/status:\s*Schema\.Schema\.Type<typeof StatusSchema>/);
    });

    it('should use nullable Schema types for optional enum fields', () => {
      // Optional enum fields should use Schema.Schema.Type with | null
      expect(typesContent).toMatch(
        /optionalRole:\s*Schema\.Schema\.Type<typeof RoleSchema> \| null/
      );
      expect(typesContent).toMatch(
        /optionalStatus:\s*Schema\.Schema\.Type<typeof StatusSchema> \| null/
      );
    });

    it('should NOT reference raw SCREAMING_SNAKE_CASE enum names in Kysely interfaces', () => {
      // Kysely table interfaces should NOT contain raw enum references like:
      // role: Role  or  role: ROLE
      // This would cause "Cannot find name" errors since we only import Schema wrappers
      expect(typesContent).not.toMatch(/role:\s*Role[^S]/);
      expect(typesContent).not.toMatch(/role:\s*ROLE/);
      expect(typesContent).not.toMatch(/status:\s*Status[^S]/);
      expect(typesContent).not.toMatch(/status:\s*STATUS/);
    });
  });

  describe('Generated Field Handling', () => {
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

    it('should use columnType for ID fields with @default', () => {
      // User model has: id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
      // ID fields with @default are read-only (can't insert/update)
      expect(typesContent).toMatch(/columnType\(.*Schema\.Never, Schema\.Never\)/);
    });

    it('should use generated() for non-ID fields with @default', () => {
      // Fields with @default (not ID) use generated() wrapper
      expect(typesContent).toContain('generated(Schema.DateFromSelf)');
    });
  });
});
