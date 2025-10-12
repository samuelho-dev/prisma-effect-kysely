import { getDMMF } from "@prisma/internals";
import {
  detectImplicitManyToMany,
  getModelIdField,
  type JoinTableInfo,
} from "../prisma/relation";

describe("Implicit Many-to-Many Relation Detection", () => {
  describe("detectImplicitManyToMany", () => {
    it("should detect implicit m-n relation between Post and Category", async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         String     @id @db.Uuid
          title      String
          categories Category[]
        }

        model Category {
          id    String @id @db.Uuid
          name  String
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);

      expect(joinTables).toHaveLength(1);
      expect(joinTables[0].tableName).toBe("_CategoryToPost");
      expect(joinTables[0].modelA).toBe("Category");
      expect(joinTables[0].modelB).toBe("Post");
      expect(joinTables[0].relationName).toBe("CategoryToPost");
    });

    it("should generate correct alphabetically sorted table name", async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Zebra {
          id    String @id
          alphas Alpha[]
        }

        model Alpha {
          id     String @id
          zebras Zebra[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);

      expect(joinTables[0].tableName).toBe("_AlphaToZebra");
      expect(joinTables[0].modelA).toBe("Alpha");
      expect(joinTables[0].modelB).toBe("Zebra");
    });

    it("should extract correct ID field types (UUID)", async () => {
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

      expect(joinTables[0].columnAType).toBe("String");
      expect(joinTables[0].columnBType).toBe("String");
      expect(joinTables[0].columnAIsUuid).toBe(true);
      expect(joinTables[0].columnBIsUuid).toBe(true);
    });

    it("should extract correct ID field types (Int)", async () => {
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

      expect(joinTables[0].columnAType).toBe("Int");
      expect(joinTables[0].columnBType).toBe("Int");
      expect(joinTables[0].columnAIsUuid).toBe(false);
      expect(joinTables[0].columnBIsUuid).toBe(false);
    });

    it("should handle multiple implicit m-n relations", async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         String     @id
          categories Category[]
          tags       Tag[]
        }

        model Category {
          id    String @id
          posts Post[]
        }

        model Tag {
          id    String @id
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);

      expect(joinTables).toHaveLength(2);

      const categoryToPost = joinTables.find(
        (jt) => jt.tableName === "_CategoryToPost",
      );
      const postToTag = joinTables.find((jt) => jt.tableName === "_PostToTag");

      expect(categoryToPost).toBeDefined();
      expect(postToTag).toBeDefined();
    });

    it("should NOT detect explicit m-n relations (with intermediate model)", async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id              String            @id
          postCategories  PostCategory[]
        }

        model Category {
          id              String            @id
          postCategories  PostCategory[]
        }

        model PostCategory {
          postId     String
          categoryId String
          post       Post     @relation(fields: [postId], references: [id])
          category   Category @relation(fields: [categoryId], references: [id])

          @@id([postId, categoryId])
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);

      // Explicit m-n should not be detected as implicit
      expect(joinTables).toHaveLength(0);
    });

    it("should NOT detect one-to-many relations", async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model User {
          id    String @id
          posts Post[]
        }

        model Post {
          id       String @id
          authorId String
          author   User   @relation(fields: [authorId], references: [id])
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);

      expect(joinTables).toHaveLength(0);
    });

    it("should NOT detect self-relations", async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Employee {
          id           String     @id
          managerId    String?
          manager      Employee?  @relation("EmployeeManagement", fields: [managerId], references: [id])
          subordinates Employee[] @relation("EmployeeManagement")
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);

      expect(joinTables).toHaveLength(0);
    });

    it("should handle mixed ID types in different relations", async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model Post {
          id         String     @id @db.Uuid
          categories Category[]
          tags       Tag[]
        }

        model Category {
          id    String @id @db.Uuid
          posts Post[]
        }

        model Tag {
          id    Int    @id @default(autoincrement())
          posts Post[]
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const joinTables = detectImplicitManyToMany(dmmf.datamodel.models);

      const categoryToPost = joinTables.find(
        (jt) => jt.tableName === "_CategoryToPost",
      );
      const postToTag = joinTables.find((jt) => jt.tableName === "_PostToTag");

      expect(categoryToPost?.columnAIsUuid).toBe(true);
      expect(categoryToPost?.columnBIsUuid).toBe(true);
      expect(postToTag?.columnAIsUuid).toBe(true); // Post has UUID
      expect(postToTag?.columnBIsUuid).toBe(false); // Tag has Int
    });
  });

  describe("getModelIdField", () => {
    it("should extract @id field from model", async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model User {
          id    String @id @db.Uuid
          email String
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const userModel = dmmf.datamodel.models.find((m) => m.name === "User")!;
      const idField = getModelIdField(userModel);

      expect(idField.name).toBe("id");
      expect(idField.type).toBe("String");
      expect(idField.isId).toBe(true);
    });

    it("should extract first field from composite @@id", async () => {
      const schema = `
        datasource db {
          provider = "postgresql"
          url = "postgresql://localhost:5432/test"
        }

        model UserRole {
          userId String
          roleId String

          @@id([userId, roleId])
        }
      `;

      const dmmf = await getDMMF({ datamodel: schema });
      const model = dmmf.datamodel.models.find((m) => m.name === "UserRole")!;
      const idField = getModelIdField(model);

      // For composite IDs, we should get the first field
      expect(idField.name).toBe("userId");
      expect(idField.type).toBe("String");
    });

    it("should throw error if Prisma schema validation allows model without ID", () => {
      // Prisma validates schemas, so we need to test getModelIdField directly
      // with a manually crafted model object
      const mockModel: any = {
        name: "InvalidModel",
        fields: [
          { name: "name", type: "String", isId: false },
        ],
        primaryKey: null,
      };

      expect(() => getModelIdField(mockModel)).toThrow(
        "Model InvalidModel has no ID field",
      );
    });
  });
});
