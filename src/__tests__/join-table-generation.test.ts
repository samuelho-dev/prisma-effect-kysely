import { getDMMF } from '@prisma/internals';
import { detectImplicitManyToMany } from '../prisma/relation';
import { generateJoinTableSchema } from '../effect/join-table';

/**
 * Join Table Generation - Functional Behavior Tests
 *
 * Tests verify BEHAVIOR not IMPLEMENTATION:
 * - Does generated code use semantic field names (category_id vs A)?
 * - Are field names properly mapped to Prisma's A/B columns?
 * - Do generated schemas support operational types (Select/Insert/Update)?
 * - Does the generator handle different ID types (UUID, Int)?
 *
 * Minimal string matching - focus on key generated patterns.
 * NO type coercions (as any, as unknown).
 */

describe('Join Table Generation - Functional Tests', () => {
  describe('Semantic Field Names with A/B Mapping', () => {
    it('should generate semantic snake_case field names mapped to database A/B columns', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         String     @id @db.Uuid
          categories Category[]
        }

        model Category {
          id    String @id @db.Uuid
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      // Should use semantic names in TypeScript
      expect(generated).toContain('category_id:');
      expect(generated).toContain('post_id:');

      // Should map to database A/B columns
      expect(generated).toContain('Schema.fromKey("A")');
      expect(generated).toContain('Schema.fromKey("B")');

      // Should use propertySignature for mapping
      expect(generated).toContain('Schema.propertySignature');

      // Should NOT use raw A/B field names
      expect(generated).not.toMatch(/\bA:\s+columnType/);
      expect(generated).not.toMatch(/\bB:\s+columnType/);
    });

    it('should handle multi-word model names with snake_case', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Product {
          id   String      @id
          tags ProductTag[]
        }

        model ProductTag {
          id       String    @id
          products Product[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      // Product < ProductTag alphabetically, so A = Product, B = ProductTag
      expect(generated).toContain('product_id:');
      expect(generated).toContain('product_tag_id:');
      expect(generated).toContain('Schema.fromKey("A")');
      expect(generated).toContain('Schema.fromKey("B")');
    });
  });

  describe('Schema Structure Generation', () => {
    it('should generate base schema with underscore prefix', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         String     @id @db.Uuid
          categories Category[]
        }

        model Category {
          id    String @id @db.Uuid
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      expect(generated).toContain('export const _CategoryToPost');
      expect(generated).toContain('Schema.Struct({');
    });

    it('should generate operational schemas with PascalCase', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         String     @id
          categories Category[]
        }

        model Category {
          id    String @id
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      expect(generated).toContain('export const CategoryToPost = getSchemas(_CategoryToPost)');
    });

    it('should include descriptive comment header', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         String     @id
          categories Category[]
        }

        model Category {
          id    String @id
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      expect(generated).toContain('// _CategoryToPost Join Table Schema');
      expect(generated).toContain('// Database columns: A (Category), B (Post)');
      expect(generated).toContain('// TypeScript fields: category_id, post_id');
    });
  });

  describe('Type Exports', () => {
    it('should export Select/Insert/Update types', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         String     @id
          categories Category[]
        }

        model Category {
          id    String @id
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      expect(generated).toContain('export type CategoryToPostSelect');
      expect(generated).toContain('export type CategoryToPostInsert');
      expect(generated).toContain('export type CategoryToPostUpdate');
    });

    it('should export Encoded types for Kysely compatibility', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         String     @id
          categories Category[]
        }

        model Category {
          id    String @id
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      expect(generated).toContain('export type CategoryToPostSelectEncoded');
      expect(generated).toContain('export type CategoryToPostInsertEncoded');
      expect(generated).toContain('export type CategoryToPostUpdateEncoded');
    });
  });

  describe('ID Type Handling', () => {
    it('should handle UUID ID fields', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         String     @id @db.Uuid
          categories Category[]
        }

        model Category {
          id    String @id @db.Uuid
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      expect(generated).toContain('columnType(Schema.UUID, Schema.Never, Schema.Never)');
    });

    it('should handle Int ID fields', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         Int        @id @default(autoincrement())
          categories Category[]
        }

        model Category {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      expect(generated).toContain('columnType(Schema.Number, Schema.Never, Schema.Never)');
    });

    it('should handle mixed ID types across models', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id   String @id @db.Uuid
          tags Tag[]
        }

        model Tag {
          id    Int   @id @default(autoincrement())
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      // Post comes before Tag alphabetically, so A = Post (UUID), B = Tag (Int)
      expect(generated).toContain('post_id:');
      expect(generated).toContain('columnType(Schema.UUID, Schema.Never, Schema.Never)');
      expect(generated).toContain('tag_id:');
      expect(generated).toContain('columnType(Schema.Number, Schema.Never, Schema.Never)');
    });
  });

  describe('Read-Only Foreign Keys', () => {
    it('should use columnType for read-only behavior on both columns', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model User {
          id    String @id
          roles Role[]
        }

        model Role {
          id    String @id
          users User[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      // Both columns should use columnType with Never for insert/update
      const columnTypeMatches = generated.match(/columnType/g);
      expect(columnTypeMatches).toHaveLength(2); // Once for A, once for B

      // Should use Never for insert and update (read-only)
      expect(generated).toContain('Schema.Never, Schema.Never');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle complex M2M with compound names', async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model UserProfile {
          id           String         @id
          permissions  UserPermission[]
        }

        model UserPermission {
          id       String       @id
          profiles UserProfile[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);
      const generated = generateJoinTableSchema(joinTables[0], dmmf);

      // Should generate semantic snake_case for compound words
      expect(generated).toContain('user_permission_id:');
      expect(generated).toContain('user_profile_id:');

      // Should still map to A/B
      expect(generated).toContain('Schema.fromKey("A")');
      expect(generated).toContain('Schema.fromKey("B")');
    });
  });
});
