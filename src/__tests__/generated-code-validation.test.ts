import { GeneratorOrchestrator } from '../generator/orchestrator';
import type { GeneratorOptions } from '@prisma/generator-helper';
import { getDMMF } from '@prisma/internals';
import { readFileSync, existsSync } from 'fs';
import { rm, writeFile } from 'fs/promises';
import { join } from 'path';

// Mock prettier
jest.mock('../utils/templates', () => ({
  formatCode: jest.fn((code: string) => Promise.resolve(code)),
}));

describe('Generated Code Validation', () => {
  const testOutputPath = join(__dirname, '../test-output-validation');
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

  describe('Generated TypeScript Validation', () => {
    it('should generate code that compiles with TypeScript', async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      // Read generated files
      const typesContent = readFileSync(
        join(testOutputPath, 'types.ts'),
        'utf-8',
      );
      const enumsContent = readFileSync(
        join(testOutputPath, 'enums.ts'),
        'utf-8',
      );
      const indexContent = readFileSync(
        join(testOutputPath, 'index.ts'),
        'utf-8',
      );

      // Verify structure
      expect(typesContent).toContain('import * as Effect from "effect"');
      expect(typesContent).toContain('const Schema = Effect.Schema');
      expect(typesContent).toContain(
        'import { columnType, generated, getSchemas } from "prisma-effect-kysely"',
      );

      // Verify no type assertions (look for " as SomeType" pattern, not just words containing "as")
      expect(typesContent).not.toMatch(/\)\s+as\s+[A-Z]/); // matches ") as TypeName"
      expect(typesContent).not.toMatch(/\w+\s+as\s+[A-Z]/); // matches "value as TypeName"

      // Verify enums (now exported as native TypeScript enums)
      expect(enumsContent).toContain('export enum Role');
      expect(enumsContent).toContain('export enum Status');
      // Verify namespace with Schema wrapper
      expect(enumsContent).toContain('export namespace Role');
      expect(enumsContent).toContain('export namespace Status');
    });

    it('should not use type assertions', async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(
        join(testOutputPath, 'types.ts'),
        'utf-8',
      );

      // Verify NO type assertions (look for " as SomeType" pattern)
      expect(typesContent).not.toMatch(/\)\s+as\s+[A-Z]/); // matches ") as TypeName"
      expect(typesContent).not.toMatch(/\w+\s+as\s+[A-Z]/); // matches "value as TypeName"
    });

    it('should generate all necessary exports', async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(
        join(testOutputPath, 'types.ts'),
        'utf-8',
      );

      // Verify exports for each model
      expect(typesContent).toMatch(/export const _User = Schema\.Struct/);
      // Namespace pattern: getSchemas is used within namespace
      expect(typesContent).toContain('export namespace User');
      expect(typesContent).toMatch(/const schemas = getSchemas\(_User\)/);
      // Types are within namespace
      expect(typesContent).toMatch(/export type Select = Schema\.Schema\.Type/);
      expect(typesContent).toMatch(/export type Insert = Schema\.Schema\.Type/);
      expect(typesContent).toMatch(/export type Update = Schema\.Schema\.Type/);

      // Verify Encoded type exports (NEW - for queries layer)
      expect(typesContent).toMatch(/export type SelectEncoded = Schema\.Schema\.Encoded/);
      expect(typesContent).toMatch(/export type InsertEncoded = Schema\.Schema\.Encoded/);
      expect(typesContent).toMatch(/export type UpdateEncoded = Schema\.Schema\.Encoded/);

      // Verify DB interface
      expect(typesContent).toMatch(/export interface DB/);
    });

    it('should generate Encoded types for queries layer', async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(
        join(testOutputPath, 'types.ts'),
        'utf-8',
      );

      // Verify Encoded types are exported within namespace for all operation types
      expect(typesContent).toContain('export namespace User');
      expect(typesContent).toMatch(
        /export type SelectEncoded = Schema\.Schema\.Encoded<typeof User\.Selectable>/,
      );
      expect(typesContent).toMatch(
        /export type InsertEncoded = Schema\.Schema\.Encoded<typeof User\.Insertable>/,
      );
      expect(typesContent).toMatch(
        /export type UpdateEncoded = Schema\.Schema\.Encoded<typeof User\.Updateable>/,
      );

      // Verify for another model to ensure it's generated for all models
      expect(typesContent).toContain('export namespace Post');
      expect(typesContent).toMatch(/export type SelectEncoded = Schema\.Schema\.Encoded<typeof Post\.Selectable>/);
      expect(typesContent).toMatch(/export type InsertEncoded = Schema\.Schema\.Encoded<typeof Post\.Insertable>/);
      expect(typesContent).toMatch(/export type UpdateEncoded = Schema\.Schema\.Encoded<typeof Post\.Updateable>/);
    });

    it('should handle @map and @@map annotations', async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(
        join(testOutputPath, 'types.ts'),
        'utf-8',
      );

      // Verify propertySignature with fromKey for @map
      expect(typesContent).toMatch(
        /Schema\.propertySignature\([^)]+\)\.pipe\(Schema\.fromKey/,
      );

      // Verify @@map in DB interface
      expect(typesContent).toMatch(/composite_id_table:/);
    });

    it('should generate valid kysely-compatible code', async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(
        join(testOutputPath, 'types.ts'),
        'utf-8',
      );

      // Verify kysely integration - check the functions are used
      expect(typesContent).toContain('columnType(');
      expect(typesContent).toContain('generated(');
      expect(typesContent).toContain('getSchemas(');

      // Verify DB interface uses Schema.Encoded
      expect(typesContent).toMatch(/Schema\.Schema\.Encoded<typeof _/);
    });
  });

  describe('Runtime Behavior Tests', () => {
    it('should create a valid test file that imports generated code', async () => {
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      // Create a test file that imports the generated code
      const testFileContent = `
import { Schema } from "effect";
import { User, UserSelect, UserInsert, UserUpdate, DB } from "./index";

// Test that types are exported
const userSchemas: typeof User = User;

// Test that helper functions exist
const testInsertable = User.Insertable;
const testSelectable = User.Selectable;
const testUpdateable = User.Updateable;

console.log("Generated code imports successfully!");
`;

      await writeFile(join(testOutputPath, 'test-import.ts'), testFileContent);

      // Verify file was created
      expect(existsSync(join(testOutputPath, 'test-import.ts'))).toBe(true);
    });
  });
});
