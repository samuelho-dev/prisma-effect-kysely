import { GeneratorOrchestrator } from '../generator/orchestrator';
import type { GeneratorOptions } from '@prisma/generator-helper';
import { getDMMF } from '@prisma/internals';
import { readFileSync, existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';

// Mock prettier to avoid dynamic import issues in Jest
jest.mock('../utils/templates', () => ({
  formatCode: jest.fn((code: string) => Promise.resolve(code)),
}));

describe('Prisma Effect Schema Generator - E2E', () => {
  const testOutputPath = join(__dirname, '../test-output');
  const fixtureSchemaPath = join(__dirname, 'fixtures/test.prisma');

  let dmmf: any;

  beforeAll(async () => {
    // Load DMMF from test schema
    const schemaContent = readFileSync(fixtureSchemaPath, 'utf-8');
    dmmf = await getDMMF({ datamodel: schemaContent });
  });

  afterEach(async () => {
    // Clean up test output
    if (existsSync(testOutputPath)) {
      await rm(testOutputPath, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    dmmf = undefined;
  });

  describe('File Generation', () => {
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
  });

  describe('Error Handling', () => {
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

      // Should still generate files even with empty schema
      expect(existsSync(join(testOutputPath, 'enums.ts'))).toBe(true);
      expect(existsSync(join(testOutputPath, 'types.ts'))).toBe(true);
      expect(existsSync(join(testOutputPath, 'index.ts'))).toBe(true);

      // Should have valid structure but no content
      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');
      expect(typesContent).toContain('import { Schema } from "effect"');
      expect(typesContent).toContain('export interface DB');
    });

    it('should handle model with unsupported field type', async () => {
      const unsupportedDMMF = {
        datamodel: {
          models: [
            {
              name: 'TestModel',
              dbName: null,
              fields: [
                {
                  name: 'id',
                  type: 'Int',
                  kind: 'scalar',
                  isRequired: true,
                  isId: true,
                  isList: false,
                  hasDefaultValue: false,
                },
                {
                  name: 'unsupportedField',
                  type: 'UnknownType',
                  kind: 'scalar',
                  isRequired: true,
                  isList: false,
                  hasDefaultValue: false,
                },
              ],
            },
          ],
          enums: [],
        },
      };

      const options = {
        generator: { output: { value: testOutputPath } },
        dmmf: unsupportedDMMF,
      } as unknown as GeneratorOptions;

      // Should not throw, should default to Schema.Unknown
      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');
      expect(typesContent).toContain('unsupportedField: Schema.Unknown');
    });

    it('should create output directory if it does not exist', async () => {
      const newOutputPath = join(testOutputPath, 'nested', 'deeply', 'created');

      const options: GeneratorOptions = {
        generator: { output: { value: newOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      expect(existsSync(join(newOutputPath, 'types.ts'))).toBe(true);

      // Cleanup
      await rm(join(testOutputPath, 'nested'), {
        recursive: true,
        force: true,
      });
    });
  });

  describe('Enum Generation', () => {
    let enumsContent: string;

    beforeEach(async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);
      enumsContent = readFileSync(join(testOutputPath, 'enums.ts'), 'utf-8');
    });

    it('should generate Role enum with Schema.Enums', () => {
      // New behavior: native TypeScript enum + Schema.Enums wrapper
      expect(enumsContent).toContain('export enum Role {');
      expect(enumsContent).toContain('export const RoleSchema = Schema.Enums(Role)');
      expect(enumsContent).toContain('"ADMIN"');
      expect(enumsContent).toContain('"GUEST"');
      expect(enumsContent).toContain('"USER"');
      // Should NOT use Schema.Literal pattern anymore
      expect(enumsContent).not.toContain('Schema.Literal');
    });

    it('should handle @map annotations in Status enum', () => {
      // New behavior: native TypeScript enum with Schema.Enums wrapper
      expect(enumsContent).toContain('export enum Status {');
      expect(enumsContent).toContain('export const StatusSchema = Schema.Enums(Status)');
      expect(enumsContent).toContain('"active"');
      expect(enumsContent).toContain('"inactive"');
      expect(enumsContent).toContain('"pending"');
    });
  });

  describe('Type Mapping', () => {
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

    it('should map String to Schema.String', () => {
      expect(typesContent).toMatch(/stringField:\s*Schema\.String/);
    });

    it('should map optional String to Schema.UndefinedOr(Schema.String)', () => {
      expect(typesContent).toMatch(/optionalString:\s*Schema\.UndefinedOr\(Schema\.String\)/);
    });

    it('should map String[] to Schema.Array(Schema.String)', () => {
      expect(typesContent).toMatch(/stringArray:\s*Schema\.Array\(Schema\.String\)/);
    });

    it('should map Int/Float to Schema.Number', () => {
      expect(typesContent).toMatch(/intField:\s*Schema\.Number/);
      expect(typesContent).toMatch(/floatField:\s*Schema\.Number/);
    });

    it('should map BigInt to Schema.BigInt', () => {
      expect(typesContent).toMatch(/bigIntField:\s*Schema\.BigInt/);
    });

    it('should map Boolean to Schema.Boolean', () => {
      expect(typesContent).toMatch(/boolField:\s*Schema\.Boolean/);
    });

    it('should map DateTime to Schema.Date', () => {
      expect(typesContent).toMatch(/dateField:\s*Schema\.Date/);
    });

    it('should map Json to Schema.Unknown', () => {
      expect(typesContent).toMatch(/jsonField:\s*Schema\.Unknown/);
    });

    it('should use Schema wrapper for enum fields', () => {
      // New behavior: Use RoleSchema and StatusSchema (Schema wrappers)
      expect(typesContent).toMatch(/\brole:\s*RoleSchema\b/);
      expect(typesContent).toMatch(/\bstatus:\s*StatusSchema\b/);
    });
  });

  describe('UUID Detection', () => {
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

    it('should detect UUID via @db.Uuid native type (Strategy 1)', () => {
      // AllTypes.id has @db.Uuid
      expect(typesContent).toMatch(/AllTypes[\s\S]*?id:\s*Schema\.UUID/);

      // AllTypes.session_id has @db.Uuid @default(dbgenerated("gen_random_uuid()"))
      expect(typesContent).toMatch(/_AllTypes[\s\S]*?session_id:\s*generated\(Schema\.UUID\)/);
    });

    it('should detect UUID via documentation comment (Strategy 2)', () => {
      // AllTypes.tenant_id has /// @db.Uuid comment
      expect(typesContent).toMatch(/AllTypes[\s\S]*?tenant_id:\s*Schema\.UUID/);
    });

    it('should detect UUID via field name patterns (Strategy 3 - Fallback)', () => {
      // User.id matches /^id$/ pattern (with columnType for @id @default)
      expect(typesContent).toMatch(/_User[\s\S]*?id:\s*columnType\(Schema\.UUID/);
      // Profile.userId matches /_id$/ pattern
      expect(typesContent).toMatch(/_Profile[\s\S]*?userId:\s*Schema\.UUID/);
    });

    it('should detect optional UUID fields', () => {
      // Employee.managerId is optional and matches UUID patterns
      expect(typesContent).toMatch(
        /Employee[\s\S]*?managerId:\s*Schema\.UndefinedOr\(Schema\.UUID\)/
      );
    });

    it('should NOT detect non-UUID String fields', () => {
      // Fields like 'name', 'email', 'description' should be Schema.String
      expect(typesContent).toMatch(/_User[\s\S]*?name:\s*Schema\.String/);
      expect(typesContent).toMatch(/_User[\s\S]*?email:\s*Schema\.String/);
    });
  });

  describe('Relation Field Handling', () => {
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

    it('should exclude relation fields from schemas', () => {
      // User has 'profile' and 'posts' relation fields - should be excluded
      const userMatch = typesContent.match(/export const _User = Schema\.Struct\(\{([^}]+)\}\)/s);
      expect(userMatch).toBeTruthy();
      expect(userMatch![1]).not.toContain('profile:');
      expect(userMatch![1]).not.toContain('posts:');
    });

    it('should include foreign key fields', () => {
      // Profile.userId is a foreign key - should be included
      expect(typesContent).toMatch(/Profile[\s\S]*?userId:/);
      // Post.authorId is a foreign key - should be included
      expect(typesContent).toMatch(/Post[\s\S]*?authorId:/);
    });

    it('should exclude @ignore fields', () => {
      // AllTypes.ignoredField has @ignore
      expect(typesContent).not.toMatch(/AllTypes[\s\S]*?ignoredField:/);
    });
  });

  describe('Field Sorting & Determinism', () => {
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

    it('should sort model fields alphabetically', () => {
      const userMatch = typesContent.match(/export const _User = Schema\.Struct\(\{([^}]+)\}\)/s);
      expect(userMatch).toBeTruthy();

      const fieldNames = [...userMatch![1].matchAll(/(\w+):/g)].map((m) => m[1]);
      const sortedFields = [...fieldNames].sort();

      expect(fieldNames).toEqual(sortedFields);
    });
  });

  describe('@map Support', () => {
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

    it('should handle @map directive on regular fields', () => {
      // AllTypes.mappedField has @map("db_mapped_field")
      expect(typesContent).toMatch(
        /mappedField:\s*Schema\.propertySignature\(Schema\.String\)\.pipe\(Schema\.fromKey\("db_mapped_field"\)\)/
      );
    });

    it('should apply Kysely helpers BEFORE @map wrapper', () => {
      // AllTypes.mappedWithDefault has both @default(0) and @map("mapped_default")
      // Correct order: Schema.propertySignature(generated(Schema.Number)).pipe(Schema.fromKey("mapped_default"))
      expect(typesContent).toMatch(
        /mappedWithDefault:\s*Schema\.propertySignature\(generated\(Schema\.Number\)\)\.pipe\(Schema\.fromKey\("mapped_default"\)\)/
      );
      // This pattern should NOT exist (wrong order - generated wrapping propertySignature)
      expect(typesContent).not.toMatch(/generated\(Schema\.propertySignature\(/);
    });

    it('should apply Kysely helpers BEFORE @map for columnType too', () => {
      // ID fields with @default and @map should have columnType INSIDE propertySignature
      // Correct pattern: Schema.propertySignature(columnType(...)).pipe(fromKey(...))
      // Wrong pattern: columnType(Schema.propertySignature(...))
      expect(typesContent).not.toMatch(/columnType\(Schema\.propertySignature\(/);
    });
  });

  describe('DBSchema Generation', () => {
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
      // Base schemas should have underscore prefix (e.g., _User, _Post)
      expect(typesContent).toMatch(/export const _AllTypes = Schema\.Struct/);
      expect(typesContent).toMatch(/export const _User = Schema\.Struct/);
      expect(typesContent).toMatch(/export const _Profile = Schema\.Struct/);
      expect(typesContent).toMatch(/export const _Post = Schema\.Struct/);
      expect(typesContent).toMatch(/export const _Category = Schema\.Struct/);
      expect(typesContent).toMatch(/export const _Employee = Schema\.Struct/);
      expect(typesContent).toMatch(/export const _CompositeIdModel = Schema\.Struct/);
    });

    it('should generate DB interface with SelectEncoded types', () => {
      expect(typesContent).toContain('export interface DB');
      expect(typesContent).toMatch(/:\s*\w+SelectEncoded;/);
    });

    it('should use @@map directive for table names in DB interface', () => {
      // CompositeIdModel has @@map("composite_id_table")
      expect(typesContent).toMatch(/composite_id_table:\s*CompositeIdModelSelectEncoded/);
    });
  });

  describe('Index File', () => {
    let indexContent: string;

    beforeEach(async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);
      indexContent = readFileSync(join(testOutputPath, 'index.ts'), 'utf-8');
    });

    it('should re-export enums and types', () => {
      expect(indexContent).toContain('export * from "./enums"');
      expect(indexContent).toContain('export * from "./types"');
    });
  });

  describe('Naming Standardization', () => {
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

    it('should convert snake_case model names to PascalCase for exports', () => {
      // Base schema should keep original name with underscore prefix
      expect(typesContent).toMatch(/export const _session_model_preference = Schema\.Struct/);

      // Operational schema should use PascalCase
      expect(typesContent).toMatch(
        /export const SessionModelPreference = getSchemas\(_session_model_preference\)/
      );
    });

    it('should generate PascalCase type exports for snake_case models', () => {
      // Type exports should use PascalCase
      expect(typesContent).toContain(
        'export type SessionModelPreferenceSelect = Schema.Schema.Type<typeof SessionModelPreference.Selectable>'
      );
      expect(typesContent).toContain(
        'export type SessionModelPreferenceInsert = Schema.Schema.Type<typeof SessionModelPreference.Insertable>'
      );
      expect(typesContent).toContain(
        'export type SessionModelPreferenceUpdate = Schema.Schema.Type<typeof SessionModelPreference.Updateable>'
      );
    });

    it('should generate PascalCase encoded type exports for snake_case models', () => {
      // Encoded type exports should also use PascalCase
      expect(typesContent).toContain(
        'export type SessionModelPreferenceSelectEncoded = Schema.Schema.Encoded<typeof SessionModelPreference.Selectable>'
      );
      expect(typesContent).toContain(
        'export type SessionModelPreferenceInsertEncoded = Schema.Schema.Encoded<typeof SessionModelPreference.Insertable>'
      );
      expect(typesContent).toContain(
        'export type SessionModelPreferenceUpdateEncoded = Schema.Schema.Encoded<typeof SessionModelPreference.Updateable>'
      );
    });

    it('should not affect PascalCase model names', () => {
      // Existing PascalCase models should remain unchanged
      expect(typesContent).toMatch(/export const User = getSchemas\(_User\)/);
      expect(typesContent).toContain('export type UserSelect');
      expect(typesContent).toContain('export type UserInsert');
    });
  });
});
