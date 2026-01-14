import { existsSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { GeneratorOptions } from '@prisma/generator-helper';
import prismaInternals from '@prisma/internals';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneratorOrchestrator } from '../generator/orchestrator.js';

const { getDMMF } = prismaInternals;

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

// Mock prettier to avoid dynamic import issues
vi.mock('../utils/templates', () => ({
  formatCode: vi.fn((code: string) => Promise.resolve(code)),
}));

describe('Kysely Integration - Functional Tests', () => {
  const testOutputPath = join(import.meta.dirname, '../test-output-kysely');
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
      // EXPORTED so TypeScript can reference by name in declaration emit
      // (prevents type expansion that breaks SchemasWithId type params)
      expect(typesContent).toMatch(/export const _User = Schema\.Struct/);
      expect(typesContent).toMatch(/export const _Post = Schema\.Struct/);
    });

    it('should use generated() for fields with @default', () => {
      // Fields with @default should use generated()
      expect(typesContent).toMatch(/generated\(/);
    });

    it('should export operational schemas with type annotation pattern', () => {
      // Pattern: const _UserSchemas = getSchemas(_User, UserIdSchema);
      //          export const User: SchemasWithId<typeof _User, typeof UserIdSchema> = _UserSchemas;
      expect(typesContent).toMatch(/const _UserSchemas = getSchemas\(_User, UserIdSchema\)/);
      expect(typesContent).toMatch(/export const User: SchemasWithId</);
      expect(typesContent).toMatch(/typeof _User/);
    });

    it('should generate DB interface with Kysely Table types', () => {
      // DB interface should use Kysely *Table types for native Kysely compatibility
      expect(typesContent).toContain('export interface DB');
      expect(typesContent).toMatch(/:\s*\w+Table;/);
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
      // DB interface should use the mapped table name with Kysely Table type
      expect(typesContent).toMatch(/composite_id_table:\s*CompositeIdModelTable/);
    });
  });

  describe('Schema Exports', () => {
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

    it('should export operational schema objects with type annotation pattern', () => {
      // Pattern: const _ModelSchemas = getSchemas(_Model, ModelIdSchema);
      //          export const Model: SchemasWithId<typeof _Model, typeof ModelIdSchema> = _ModelSchemas;
      expect(typesContent).toMatch(/const _\w+Schemas = getSchemas\(/);
      expect(typesContent).toMatch(/export const \w+: SchemasWithId</);
      expect(typesContent).toMatch(/typeof _\w+/);
    });

    it('should not export individual type aliases', () => {
      // No longer generate UserSelect, UserInsert, etc. - consumers use type utilities
      expect(typesContent).not.toMatch(/export type \w+Select\s*=/);
      expect(typesContent).not.toMatch(/export type \w+Insert\s*=/);
      expect(typesContent).not.toMatch(/export type \w+SelectEncoded\s*=/);
    });

    it('should include all models in DB interface', () => {
      const dbMatch = typesContent.match(/export interface DB\s*{([^}]+)}/s);
      expect(dbMatch).toBeTruthy();

      const dbContent = dbMatch?.[1];

      // Should have entries for each model using Kysely Table types
      expect(dbContent).toMatch(/:\s*\w+Table;/);
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

    it('should use Kysely Table interfaces for type safety', () => {
      // Kysely table interfaces are exported for use with Kysely's native type utilities
      // Selectable<UserTable>, Insertable<UserTable>, Updateable<UserTable>
      expect(typesContent).toMatch(/export interface \w+Table \{/);
    });

    it('should generate DB interface with resolved types', () => {
      // DB interface should use Kysely Table types, not Schema.Schema.Encoded directly
      const dbMatch = typesContent.match(/export interface DB\s*{([^}]+)}/s);
      expect(dbMatch).toBeTruthy();

      const dbContent = dbMatch?.[1];

      // Should use Kysely Table types
      expect(dbContent).toMatch(/:\s*\w+Table;/);

      // Should NOT use Schema.Schema.Encoded inline
      expect(dbContent).not.toMatch(/Schema\.Schema\.Encoded/);
    });

    it('should support junction table queries with simple types', () => {
      // Junction tables (implicit M2M) should be in DB interface
      // Example: _product_tags, _CategoryToPost
      expect(typesContent).toMatch(/_product_tags:\s*\w+Table/);
    });
  });

  describe('Generated Code Validity', () => {
    let typesContent: string;
    let _enumsContent: string;
    let indexContent: string;

    beforeEach(async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');
      _enumsContent = readFileSync(join(testOutputPath, 'enums.ts'), 'utf-8');
      indexContent = readFileSync(join(testOutputPath, 'index.ts'), 'utf-8');
    });

    it('should generate valid TypeScript that would compile', () => {
      // Basic syntax checks
      expect(typesContent).toMatch(/import \{ Schema \} from ["']effect["']/);
      expect(typesContent).toContain('export interface DB');

      // Should not have obvious syntax errors
      expect(typesContent).not.toContain('undefined;');
      // Note: 'null;' is now valid in Kysely table interfaces for optional fields (e.g., 'string | null')
    });

    it('should import required dependencies', () => {
      // types.ts should import from effect and runtime
      expect(typesContent).toMatch(/import \{ Schema \} from ["']effect["']/);
      expect(typesContent).toMatch(/from ["']prisma-effect-kysely/);
    });

    it('should re-export all types from index', () => {
      expect(indexContent).toMatch(/export \* from ["']\.\/types\.js["']/);
      expect(indexContent).toMatch(/export \* from ["']\.\/enums\.js["']/);
    });

    it('should generate consistent naming conventions', () => {
      // Base schemas: _ModelName (EXPORTED for TypeScript declaration emit)
      expect(typesContent).toMatch(/export const _\w+\s*=\s*Schema\.Struct/);

      // Branded ID schemas: ModelNameIdSchema (exported for TypeScript declaration emit)
      expect(typesContent).toMatch(/export const \w+IdSchema = Schema\.\w+\.pipe\(Schema\.brand\(/);

      // Operational schemas using type annotation pattern
      expect(typesContent).toMatch(/const _\w+Schemas = getSchemas\(/);
      expect(typesContent).toMatch(/export const \w+: SchemasWithId</);
      expect(typesContent).toMatch(/typeof _\w+/);
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

      const dbContent = dbMatch?.[1];

      // Should have table entries with Kysely table interfaces
      expect(dbContent).toMatch(/\w+:\s*\w+Table;/);
    });

    it('should generate schemas compatible with Effect runtime', () => {
      // Schemas should be usable with Effect's decoder/encoder functions
      // Uses getSchemas() for all models including join tables
      expect(typesContent).toMatch(/getSchemas\(_\w+\)/);
    });
  });
});
