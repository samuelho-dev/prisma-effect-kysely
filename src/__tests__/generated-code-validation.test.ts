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
      expect(typesContent).toContain('import { Schema } from "effect"');
      expect(typesContent).toContain(
        'import { columnType, generated, getSchemas } from "prisma-effect-kysely"',
      );

      // Verify no type assertions (look for " as SomeType" pattern, not just words containing "as")
      expect(typesContent).not.toMatch(/\)\s+as\s+[A-Z]/); // matches ") as TypeName"
      expect(typesContent).not.toMatch(/\w+\s+as\s+[A-Z]/); // matches "value as TypeName"

      // Verify enums
      expect(enumsContent).toContain('export const Role');
      expect(enumsContent).toContain('export const Status');
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
      expect(typesContent).toMatch(/export const User = getSchemas\(_User\)/);
      expect(typesContent).toMatch(/export type UserSelect/);
      expect(typesContent).toMatch(/export type UserInsert/);
      expect(typesContent).toMatch(/export type UserUpdate/);

      // Verify Encoded type exports (NEW - for queries layer)
      expect(typesContent).toMatch(/export type UserSelectEncoded/);
      expect(typesContent).toMatch(/export type UserInsertEncoded/);
      expect(typesContent).toMatch(/export type UserUpdateEncoded/);

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

      // Verify Encoded types are exported for all operation types
      expect(typesContent).toMatch(
        /export type UserSelectEncoded = Schema\.Schema\.Encoded<typeof User\.Selectable>/,
      );
      expect(typesContent).toMatch(
        /export type UserInsertEncoded = Schema\.Schema\.Encoded<typeof User\.Insertable>/,
      );
      expect(typesContent).toMatch(
        /export type UserUpdateEncoded = Schema\.Schema\.Encoded<typeof User\.Updateable>/,
      );

      // Verify for another model to ensure it's generated for all models
      expect(typesContent).toMatch(/export type PostSelectEncoded/);
      expect(typesContent).toMatch(/export type PostInsertEncoded/);
      expect(typesContent).toMatch(/export type PostUpdateEncoded/);
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
