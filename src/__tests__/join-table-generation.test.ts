import { getDMMF } from '@prisma/internals';
import { detectImplicitManyToMany } from '../prisma/relation';
import { generateJoinTableSchema } from '../effect/join-table';

describe('Join Table Schema Generation', () => {
  describe('generateJoinTableSchema', () => {
    it('should generate Effect Schema with semantic snake_case field names mapped to A/B', async () => {
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
      // Should use semantic names (category_id, post_id) mapped to A/B
      expect(generated).toContain(
        'category_id: Schema.propertySignature(columnType(Schema.UUID, Schema.Never, Schema.Never)).pipe(Schema.fromKey("A"))'
      );
      expect(generated).toContain(
        'post_id: Schema.propertySignature(columnType(Schema.UUID, Schema.Never, Schema.Never)).pipe(Schema.fromKey("B"))'
      );
    });

    it('should generate PascalCase export name without underscore', async () => {
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

      expect(generated).toContain('export const CategoryToPost = getSchemas(_CategoryToPost)');
    });

    it('should generate operational schemas (Selectable/Insertable/Updateable)', async () => {
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
      expect(generated).toContain('export type CategoryToPostSelect');
      expect(generated).toContain('export type CategoryToPostInsert');
      expect(generated).toContain('export type CategoryToPostUpdate');
    });

    it('should generate Encoded type exports', async () => {
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

    it('should handle Int ID fields (non-UUID)', async () => {
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

      expect(generated).toContain(
        'category_id: Schema.propertySignature(columnType(Schema.Number, Schema.Never, Schema.Never)).pipe(Schema.fromKey("A"))'
      );
      expect(generated).toContain(
        'post_id: Schema.propertySignature(columnType(Schema.Number, Schema.Never, Schema.Never)).pipe(Schema.fromKey("B"))'
      );
    });

    it('should handle mixed ID types correctly', async () => {
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
      expect(generated).toContain(
        'post_id: Schema.propertySignature(columnType(Schema.UUID, Schema.Never, Schema.Never)).pipe(Schema.fromKey("A"))'
      );
      expect(generated).toContain(
        'tag_id: Schema.propertySignature(columnType(Schema.Number, Schema.Never, Schema.Never)).pipe(Schema.fromKey("B"))'
      );
    });

    it('should include comment header with model names and field mapping', async () => {
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

    it('should use columnType for both A and B (read-only foreign keys)', async () => {
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

      // Both should use columnType for read-only behavior
      const columnTypeMatches = generated.match(/columnType/g);
      expect(columnTypeMatches).toHaveLength(2); // Once for A, once for B
    });

    it('should generate snake_case field names for multi-word model names', async () => {
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

    it('should use propertySignature with fromKey for semantic column mapping', async () => {
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

      // Should use Schema.propertySignature with fromKey
      expect(generated).toContain('Schema.propertySignature');
      expect(generated).toContain('Schema.fromKey("A")');
      expect(generated).toContain('Schema.fromKey("B")');

      // Should NOT use plain A/B field names
      expect(generated).not.toMatch(/\bA:\s+columnType/);
      expect(generated).not.toMatch(/\bB:\s+columnType/);
    });
  });
});
