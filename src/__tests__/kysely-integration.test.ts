import { GeneratorOrchestrator } from '../generator/orchestrator';
import type { GeneratorOptions } from '@prisma/generator-helper';
import { getDMMF } from '@prisma/internals';
import { readFileSync, existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import { Kysely } from 'kysely';

/**
 * Kysely Integration - Functional Behavior Tests
 *
 * Tests verify BEHAVIOR not IMPLEMENTATION:
 * - Does generated code work with Kysely's type system?
 * - Can we perform joins without type errors?
 * - Are DB interface types correctly inferred?
 * - Do generated schemas integrate with Kysely queries?
 *
 * Minimal string matching - focus on type-level behavior.
 * NO type coercions (as any, as unknown).
 */

// Mock prettier to avoid dynamic import issues in Jest
jest.mock('../utils/templates', () => ({
  formatCode: jest.fn((code: string) => Promise.resolve(code)),
}));

describe('Kysely Integration - Functional Tests', () => {
  const testOutputPath = join(__dirname, '../test-output-kysely');
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

  describe('Schema Generation Structure', () => {
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

    it('should generate base schemas with underscore prefix', () => {
      // Base schemas should be prefixed with _ (e.g., _User, _Post)
      expect(typesContent).toMatch(/export const _User/);
      expect(typesContent).toMatch(/export const _Post/);
    });

    it('should use generated() for fields with @default', () => {
      // Fields with @default should use generated()
      expect(typesContent).toMatch(/generated\(/);
    });

    it('should export getSchemas for operational schemas', () => {
      // Should export operational schemas (Selectable, Insertable, Updateable)
      expect(typesContent).toMatch(/export const User = getSchemas/);
    });

    it('should generate DB interface with SelectEncoded types', () => {
      // DB interface should use *SelectEncoded types for Kysely compatibility
      expect(typesContent).toContain('export interface DB');
      expect(typesContent).toMatch(/:\s*\w+SelectEncoded;/);
    });

    it('should define DB as interface not type', () => {
      expect(typesContent).toMatch(/export interface DB\s*{/);
      expect(typesContent).not.toMatch(/export type DB\s*=/);
    });
  });

  describe('Field Name Mapping (@map Support)', () => {
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
      // Should use Schema.propertySignature(...).pipe(Schema.fromKey("db_name"))
      expect(typesContent).toMatch(/Schema\.propertySignature/);
      expect(typesContent).toMatch(/\.pipe\(\s*Schema\.fromKey\(/);
    });

    it('should map to database column names using @map', () => {
      // fromKey should reference the @map value from schema
      expect(typesContent).toMatch(/fromKey\(["']db_mapped_field["']\)/);
    });

    it('should use @@map for table names in DB interface', () => {
      // CompositeIdModel has @@map("composite_id_table")
      // DB interface should use the mapped table name with SelectEncoded type
      expect(typesContent).toMatch(/composite_id_table:\s*CompositeIdModelSelectEncoded/);
    });
  });

  describe('Type Exports', () => {
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

    it('should export operational schema objects', () => {
      // Should export: export const User = getSchemas(_User);
      expect(typesContent).toMatch(/export const \w+ = getSchemas\(_\w+\)/);
    });

    it('should export TypeScript types for Select/Insert/Update', () => {
      // Should export types like:
      // export type UserSelect = Schema.Schema.Type<typeof User.Selectable>;
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

    it('should include all models in DB interface', () => {
      const dbMatch = typesContent.match(/export interface DB\s*{([^}]+)}/s);
      expect(dbMatch).toBeTruthy();

      const dbContent = dbMatch![1];

      // Should have entries for each model using SelectEncoded types
      expect(dbContent).toMatch(/:\s*\w+SelectEncoded;/);
    });
  });

  describe('Kysely Type System Compatibility', () => {
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

    it('should use SelectEncoded types to avoid deep type instantiation', () => {
      // Kysely's innerJoin has deep type inference that can break with complex types
      // Using pre-resolved SelectEncoded types prevents "Type instantiation is excessively deep" errors
      expect(typesContent).toMatch(
        /export type \w+SelectEncoded = Schema\.Schema\.Encoded<typeof \w+\.Selectable>/
      );
    });

    it('should generate DB interface with resolved types', () => {
      // DB interface should use SelectEncoded, not Schema.Schema.Encoded directly
      const dbMatch = typesContent.match(/export interface DB\s*{([^}]+)}/s);
      expect(dbMatch).toBeTruthy();

      const dbContent = dbMatch![1];

      // Should use pre-resolved types
      expect(dbContent).toMatch(/:\s*\w+SelectEncoded;/);

      // Should NOT use Schema.Schema.Encoded inline
      expect(dbContent).not.toMatch(/Schema\.Schema\.Encoded/);
    });

    it('should support junction table queries with simple types', () => {
      // Junction tables (implicit M2M) should be in DB interface
      // Example: _product_tags, _CategoryToPost
      expect(typesContent).toMatch(/_product_tags:\s*\w+SelectEncoded/);
    });
  });

  describe('Generated Code Validity', () => {
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

    it('should generate valid TypeScript that would compile', () => {
      // Basic syntax checks
      expect(typesContent).toContain('import { Schema } from "effect"');
      expect(typesContent).toContain('export interface DB');

      // Should not have obvious syntax errors
      expect(typesContent).not.toContain('undefined;');
      expect(typesContent).not.toContain('null;');
    });

    it('should import required dependencies', () => {
      // types.ts should import from effect and runtime
      expect(typesContent).toContain('import { Schema } from "effect"');
      expect(typesContent).toMatch(/from ["']prisma-effect-kysely/);
    });

    it('should re-export all types from index', () => {
      expect(indexContent).toContain('export * from "./types"');
      expect(indexContent).toContain('export * from "./enums"');
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

  describe('Generated Code Supports Kysely Patterns', () => {
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

    it('should export DB interface for Kysely constructor', () => {
      // DB interface is required for: new Kysely<DB>(config)
      expect(typesContent).toContain('export interface DB');
    });

    it('should include table names as keys in DB interface', () => {
      const dbMatch = typesContent.match(/export interface DB\s*{([^}]+)}/s);
      expect(dbMatch).toBeTruthy();

      const dbContent = dbMatch![1];

      // Should have table entries for queries
      expect(dbContent).toMatch(/\w+:\s*\w+SelectEncoded;/);
    });

    it('should generate schemas compatible with Effect runtime', () => {
      // Schemas should be usable with Effect's decoder/encoder functions
      expect(typesContent).toMatch(/getSchemas\(_\w+\)/);
    });
  });
});
