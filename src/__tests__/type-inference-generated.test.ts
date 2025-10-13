import { GeneratorOrchestrator } from '../generator/orchestrator';
import type { GeneratorOptions } from '@prisma/generator-helper';
import { getDMMF } from '@prisma/internals';
import { readFileSync, existsSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import * as S from 'effect/Schema';
import { generated, getSchemas } from '../kysely/helpers';

// Mock prettier to avoid dynamic import issues in Jest
jest.mock('../utils/templates', () => ({
  formatCode: jest.fn((code: string) => Promise.resolve(code)),
}));

/**
 * TDD Test Suite: TypeScript Type Inference for Generated Fields
 *
 * Validates that the code generator creates explicit Omit types for Insert,
 * providing compile-time safety for generated fields (those with @default or @updatedAt).
 */
describe('TypeScript Type Inference for Generated Fields (v1.9.0)', () => {
  const testOutputPath = join(__dirname, '../test-output-type-inference');

  // Helper to wrap schema with datasource
  const wrapSchema = (models: string) => `
    datasource db {
      provider = "postgresql"
      url      = "postgresql://localhost:5432/test"
    }

    ${models}
  `;

  afterEach(async () => {
    if (existsSync(testOutputPath)) {
      await rm(testOutputPath, { recursive: true, force: true });
    }
  });

  describe('Generated Code Structure - Omit Utility Types', () => {
    it('should generate Omit type for models with @default fields', async () => {
      const schemaContent = wrapSchema(`
        model Agent {
          id         String @id @default(uuid()) @db.Uuid
          session_id String @default(uuid()) @db.Uuid
          name       String
        }
      `);

      const dmmf = await getDMMF({ datamodel: schemaContent });
      const options: GeneratorOptions = {
        generator: {
          output: { value: testOutputPath },
        },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');

      // Verify explicit Omit in generated Insert type
      expect(typesContent).toMatch(
        /export type AgentInsert = Omit<Schema\.Schema\.Type<typeof Agent\.Insertable>, 'id' \| 'session_id'>;/
      );

      // Verify explicit Omit in generated InsertEncoded type
      expect(typesContent).toMatch(
        /export type AgentInsertEncoded = Omit<Schema\.Schema\.Encoded<typeof Agent\.Insertable>, 'id' \| 'session_id'>;/
      );

      // Verify Select and Update types remain unchanged
      expect(typesContent).toContain(
        'export type AgentSelect = Schema.Schema.Type<typeof Agent.Selectable>;'
      );
      expect(typesContent).toContain(
        'export type AgentUpdate = Schema.Schema.Type<typeof Agent.Updateable>;'
      );
    });

    it('should generate plain type for models without generated fields', async () => {
      const schemaContent = wrapSchema(`
        model Tag {
          id   Int    @id
          name String
        }
      `);

      const dmmf = await getDMMF({ datamodel: schemaContent });
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');

      // No Omit needed when no @default fields
      expect(typesContent).toContain(
        'export type TagInsert = Schema.Schema.Type<typeof Tag.Insertable>;'
      );
      expect(typesContent).toContain(
        'export type TagInsertEncoded = Schema.Schema.Encoded<typeof Tag.Insertable>;'
      );
    });

    it('should omit @updatedAt fields from Insert types', async () => {
      const schemaContent = wrapSchema(`
        model Post {
          id        Int      @id @default(autoincrement())
          title     String
          updatedAt DateTime @updatedAt
        }
      `);

      const dmmf = await getDMMF({ datamodel: schemaContent });
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');

      // Both id and updatedAt should be omitted
      expect(typesContent).toMatch(
        /export type PostInsert = Omit<Schema\.Schema\.Type<typeof Post\.Insertable>, 'id' \| 'updatedAt'>;/
      );
    });

    it('should handle mix of ID and non-ID generated fields', async () => {
      const schemaContent = wrapSchema(`
        model User {
          id        String   @id @default(uuid()) @db.Uuid
          createdAt DateTime @default(now())
          name      String
        }
      `);

      const dmmf = await getDMMF({ datamodel: schemaContent });
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');

      // Both id and createdAt should be omitted (alphabetically sorted)
      expect(typesContent).toMatch(
        /export type UserInsert = Omit<Schema\.Schema\.Type<typeof User\.Insertable>, 'createdAt' \| 'id'>;/
      );
    });

    it('should handle multiple models with different generated field patterns', async () => {
      const schemaContent = wrapSchema(`
        model Agent {
          id   String @id @default(uuid()) @db.Uuid
          name String
        }

        model Tag {
          id   Int    @id
          name String
        }

        model Post {
          id        Int      @id @default(autoincrement())
          title     String
          createdAt DateTime @default(now())
          updatedAt DateTime @updatedAt
        }
      `);

      const dmmf = await getDMMF({ datamodel: schemaContent });
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');

      // Agent: has generated id
      expect(typesContent).toMatch(
        /export type AgentInsert = Omit<Schema\.Schema\.Type<typeof Agent\.Insertable>, 'id'>;/
      );

      // Tag: no generated fields
      expect(typesContent).toContain(
        'export type TagInsert = Schema.Schema.Type<typeof Tag.Insertable>;'
      );

      // Post: has generated id, createdAt, and updatedAt (alphabetically sorted)
      expect(typesContent).toMatch(
        /export type PostInsert = Omit<Schema\.Schema\.Type<typeof Post\.Insertable>, 'createdAt' \| 'id' \| 'updatedAt'>;/
      );
    });
  });

  describe('Type-Level Compile-Time Validation (Runtime Tests)', () => {
    it('should properly filter generated fields at runtime AND type-level', () => {
      // This test simulates what the generated code does

      // Base schema with generated fields
      const _Agent = S.Struct({
        id: generated(S.UUID),
        session_id: generated(S.UUID),
        name: S.String,
      });

      const Agent = getSchemas(_Agent);

      // Runtime validation: generated fields are filtered out
      const runtimeResult = S.decodeUnknownSync(Agent.Insertable)({
        name: 'test',
        // id and session_id not present
      });

      expect(runtimeResult).toEqual({ name: 'test' });

      // Type-level validation: Simulate the generated Omit type
      type AgentInsert = Omit<S.Schema.Type<typeof Agent.Insertable>, 'id' | 'session_id'>;

      // Valid insert - should compile and run
      const validInsert: AgentInsert = { name: 'test' };
      expect(validInsert.name).toBe('test');

      // Verify type actually excludes the fields
      type Keys = keyof AgentInsert;
      type HasId = 'id' extends Keys ? true : false;
      type HasSessionId = 'session_id' extends Keys ? true : false;

      const assertNoId: HasId = false;
      const assertNoSessionId: HasSessionId = false;

      expect(assertNoId).toBe(false);
      expect(assertNoSessionId).toBe(false);

      // Verify 'name' is present
      type HasName = 'name' extends Keys ? true : false;
      const assertHasName: HasName = true;
      expect(assertHasName).toBe(true);
    });

    it('should maintain correct types for Select and Update schemas', () => {
      const _User = S.Struct({
        id: generated(S.Number),
        name: S.String,
      });

      const User = getSchemas(_User);

      // Select should have ALL fields including generated
      type UserSelect = S.Schema.Type<typeof User.Selectable>;
      const selectValue: UserSelect = {
        id: 123,
        name: 'test',
      };
      expect(selectValue.id).toBe(123);

      // Update should have ALL fields (all optional)
      type UserUpdate = S.Schema.Type<typeof User.Updateable>;
      const updateValue: UserUpdate = {
        id: 456, // Can update generated fields
      };
      expect(updateValue.id).toBe(456);

      // Insert should omit generated fields (simulated with Omit)
      type UserInsert = Omit<S.Schema.Type<typeof User.Insertable>, 'id'>;
      const insertValue: UserInsert = { name: 'test' };
      expect(insertValue.name).toBe('test');
    });
  });

  describe('Edge Cases', () => {
    it('should handle model with only generated fields', async () => {
      const schemaContent = wrapSchema(`
        model Metadata {
          id        String   @id @default(uuid()) @db.Uuid
          createdAt DateTime @default(now())
          updatedAt DateTime @updatedAt
        }
      `);

      const dmmf = await getDMMF({ datamodel: schemaContent });
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');

      // All fields should be omitted (alphabetically sorted)
      expect(typesContent).toMatch(
        /export type MetadataInsert = Omit<Schema\.Schema\.Type<typeof Metadata\.Insertable>, 'createdAt' \| 'id' \| 'updatedAt'>;/
      );
    });

    it('should handle model with optional fields and generated fields', async () => {
      const schemaContent = wrapSchema(`
        model Product {
          id          Int     @id @default(autoincrement())
          name        String
          description String?
          price       Float?
        }
      `);

      const dmmf = await getDMMF({ datamodel: schemaContent });
      const options: GeneratorOptions = {
        generator: { output: { value: testOutputPath } },
        dmmf,
      } as GeneratorOptions;

      const orchestrator = new GeneratorOrchestrator(options);
      await orchestrator.generate(options);

      const typesContent = readFileSync(join(testOutputPath, 'types.ts'), 'utf-8');

      // Only id should be omitted (description and price are optional, not generated)
      expect(typesContent).toMatch(
        /export type ProductInsert = Omit<Schema\.Schema\.Type<typeof Product\.Insertable>, 'id'>;/
      );
    });
  });

  describe('Backwards Compatibility', () => {
    it('should maintain runtime behavior from v1.8.4', () => {
      // Verify that runtime filtering still works as expected
      const _Agent = S.Struct({
        id: generated(S.UUID),
        session_id: generated(S.UUID),
        name: S.String,
      });

      const schemas = getSchemas(_Agent);

      // Runtime: generated fields should be ABSENT from insert schema
      const result = S.decodeUnknownSync(schemas.Insertable)({
        name: 'test',
      });

      expect(result).toEqual({ name: 'test' });

      // Runtime: silently ignores generated fields if provided
      const resultWithExtra = S.decodeUnknownSync(schemas.Insertable)({
        id: '123e4567-e89b-12d3-a456-426614174000',
        session_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'test',
      });

      // Only name remains (extra fields filtered out)
      expect(resultWithExtra).toEqual({ name: 'test' });
    });
  });
});
