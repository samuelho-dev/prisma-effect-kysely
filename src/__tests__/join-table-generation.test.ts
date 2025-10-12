import { getDMMF } from "@prisma/internals";
import { detectImplicitManyToMany } from "../prisma/relation";
import { generateJoinTableSchema } from "../effect/join-table";

describe("Join Table Schema Generation", () => {
  describe("generateJoinTableSchema", () => {
    it("should generate Effect Schema with A and B columns for UUID join table", async () => {
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

      expect(generated).toContain("export const _CategoryToPost");
      expect(generated).toContain("Schema.Struct({");
      expect(generated).toContain("A: columnType(Schema.UUID, Schema.Never, Schema.Never)");
      expect(generated).toContain("B: columnType(Schema.UUID, Schema.Never, Schema.Never)");
    });

    it("should generate namespace for join table without base schema underscore", async () => {
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

      // Base schema keeps underscore: _CategoryToPost
      expect(generated).toContain("export const _CategoryToPost = Schema.Struct({");
      // Namespace removes underscore: CategoryToPost
      expect(generated).toContain("export namespace CategoryToPost");
      expect(generated).toContain("const schemas = getSchemas(_CategoryToPost)");
    });

    it("should generate operational schemas (Selectable/Insertable/Updateable)", async () => {
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

      expect(generated).toContain("export namespace CategoryToPost");
      expect(generated).toContain("const schemas = getSchemas(_CategoryToPost)");
      expect(generated).toContain("export type Select = Schema.Schema.Type<typeof CategoryToPost.Selectable>");
      expect(generated).toContain("export type Insert = Schema.Schema.Type<typeof CategoryToPost.Insertable>");
      expect(generated).toContain("export type Update = Schema.Schema.Type<typeof CategoryToPost.Updateable>");
    });

    it("should generate Encoded type exports", async () => {
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

      expect(generated).toContain("export type SelectEncoded = Schema.Schema.Encoded<typeof CategoryToPost.Selectable>");
      expect(generated).toContain("export type InsertEncoded = Schema.Schema.Encoded<typeof CategoryToPost.Insertable>");
      expect(generated).toContain("export type UpdateEncoded = Schema.Schema.Encoded<typeof CategoryToPost.Updateable>");
    });

    it("should handle Int ID fields (non-UUID)", async () => {
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

      expect(generated).toContain("A: columnType(Schema.Number, Schema.Never, Schema.Never)");
      expect(generated).toContain("B: columnType(Schema.Number, Schema.Never, Schema.Never)");
    });

    it("should handle mixed ID types correctly", async () => {
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
      expect(generated).toContain("A: columnType(Schema.UUID, Schema.Never, Schema.Never)");
      expect(generated).toContain("B: columnType(Schema.Number, Schema.Never, Schema.Never)");
    });

    it("should include comment header with model names", async () => {
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

      expect(generated).toContain("// _CategoryToPost Join Table Schema");
    });

    it("should use columnType for both A and B (read-only foreign keys)", async () => {
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
  });
});
