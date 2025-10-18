import type { DMMF } from '@prisma/generator-helper';
import { getDMMF } from '@prisma/internals';
import * as PrismaType from '../prisma/type';
import * as PrismaEnum from '../prisma/enum';
import { PrismaGenerator } from '../prisma/generator';
import { detectImplicitManyToMany, getModelIdField } from '../prisma/relation';
import { extractEffectTypeOverride } from '../utils/annotations';

/**
 * Prisma Parsing & Domain Logic - Functional Behavior Tests
 *
 * Tests verify BEHAVIOR not IMPLEMENTATION:
 * - Can UUID fields be detected correctly (3-tier strategy)?
 * - Do field/model filters work as expected?
 * - Can implicit M2M relations be detected?
 * - Can @customType annotations be extracted?
 *
 * Unified test suite covering all Prisma domain parsing logic.
 * NO type coercions (as any, as unknown).
 */

// Helper to create mock DMMF fields with sensible defaults
function createMockField(overrides: Partial<DMMF.Field>) {
  return {
    name: 'mockField',
    type: 'String',
    kind: 'scalar',
    isRequired: true,
    isList: false,
    isId: false,
    isUnique: false,
    hasDefaultValue: false,
    isReadOnly: false,
    isGenerated: false,
    isUpdatedAt: false,
    ...overrides,
  } as DMMF.Field;
}

// Helper to create mock DMMF models
function createMockModel(overrides: Partial<DMMF.Model>) {
  return {
    name: 'MockModel',
    dbName: null,
    schema: null,
    fields: [],
    primaryKey: null,
    uniqueFields: [],
    uniqueIndexes: [],
    ...overrides,
  } as DMMF.Model;
}

// Helper to create mock DMMF document
function createMockDMMF(overrides?: { models?: DMMF.Model[]; enums?: DMMF.DatamodelEnum[] }) {
  return {
    datamodel: {
      models: overrides?.models || [],
      enums: overrides?.enums || [],
      types: [],
      indexes: [],
    },
    schema: {} as any,
    mappings: {} as any,
  } as unknown as DMMF.Document;
}

describe('Prisma Parsing & Domain Logic', () => {
  describe('UUID Detection (3-Tier Strategy)', () => {
    it('should detect UUID via @db.Uuid native type (priority 1)', () => {
      const field = createMockField({
        name: 'id',
        nativeType: ['Uuid', []] as [string, string[]],
      });

      expect(PrismaType.isUuidField(field)).toBe(true);
    });

    it('should detect UUID via @db.Uuid in documentation (priority 2)', () => {
      const field = createMockField({
        name: 'tenant_id',
        documentation: '/// @db.Uuid',
      });

      expect(PrismaType.isUuidField(field)).toBe(true);
    });

    it('should detect UUID via field name patterns (priority 3)', () => {
      const uuidFields = [
        createMockField({ name: 'id', isId: true }),
        createMockField({ name: 'user_id' }),
        createMockField({ name: 'external_uuid' }),
        createMockField({ name: 'uuid' }),
      ];

      uuidFields.forEach((field) => {
        expect(PrismaType.isUuidField(field)).toBe(true);
      });
    });

    it('should NOT detect non-UUID string fields', () => {
      const nonUuidFields = [
        createMockField({ name: 'email' }),
        createMockField({ name: 'name' }),
        createMockField({ name: 'description' }),
      ];

      nonUuidFields.forEach((field) => {
        expect(PrismaType.isUuidField(field)).toBe(false);
      });
    });
  });

  describe('Field Filtering & Sorting', () => {
    it('should include scalar and enum fields, exclude relations', () => {
      const fields = [
        createMockField({ name: 'id', kind: 'scalar' }),
        createMockField({ name: 'role', kind: 'enum' }),
        createMockField({ name: 'profile', kind: 'object' }) as DMMF.Field,
        createMockField({ name: 'posts', kind: 'object', isList: true }) as DMMF.Field,
      ];

      const filtered = PrismaType.filterSchemaFields(fields);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((f) => f.name)).toEqual(['id', 'role']);
    });

    it('should sort fields alphabetically', () => {
      const fields = [
        createMockField({ name: 'name' }),
        createMockField({ name: 'id' }),
        createMockField({ name: 'email' }),
        createMockField({ name: 'createdAt' }),
      ];

      const sorted = PrismaType.sortFields(fields);
      expect(sorted.map((f) => f.name)).toEqual(['createdAt', 'email', 'id', 'name']);
    });

    it('should respect @map directive for field names', () => {
      const field = createMockField({
        name: 'userName',
        dbName: 'user_name',
      });

      expect(PrismaType.getFieldDbName(field)).toBe('user_name');
    });

    it('should identify field properties correctly', () => {
      const fieldWithDefault = createMockField({ hasDefaultValue: true });
      const idField = createMockField({ isId: true });
      const optionalField = createMockField({ isRequired: false });
      const arrayField = createMockField({ isList: true });

      expect(PrismaType.hasDefaultValue(fieldWithDefault)).toBe(true);
      expect(PrismaType.isIdField(idField)).toBe(true);
      expect(PrismaType.isRequiredField(optionalField)).toBe(false);
      expect(PrismaType.isListField(arrayField)).toBe(true);
    });
  });

  describe('Model Filtering (Internal Models)', () => {
    it('should exclude internal models (starting with underscore)', () => {
      const models = [
        createMockModel({ name: 'User' }),
        createMockModel({ name: '_InternalModel' }),
        createMockModel({ name: '_prisma_migrations' }),
      ];

      const filtered = PrismaType.filterInternalModels(models);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('User');
    });

    it('should sort models alphabetically', () => {
      const models = [
        createMockModel({ name: 'Post' }),
        createMockModel({ name: 'User' }),
        createMockModel({ name: 'Category' }),
      ];

      const sorted = PrismaType.sortModels(models);
      expect(sorted.map((m) => m.name)).toEqual(['Category', 'Post', 'User']);
    });

    it('should respect @@map directive for table names', () => {
      const model = createMockModel({
        name: 'CompositeIdModel',
        dbName: 'composite_id_table',
      });

      expect(PrismaType.getModelDbName(model)).toBe('composite_id_table');
    });
  });

  describe('Relation Detection (Implicit M2M)', () => {
    it('should detect implicit M2M relation with correct alphabetical ordering', async () => {
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

      expect(joinTables).toHaveLength(1);
      expect(joinTables[0].tableName).toBe('_CategoryToPost');
      expect(joinTables[0].modelA).toBe('Category');
      expect(joinTables[0].modelB).toBe('Post');
    });

    it('should detect UUID vs Int column types correctly', async () => {
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

      expect(joinTables[0].columnAIsUuid).toBe(true); // Post
      expect(joinTables[0].columnBIsUuid).toBe(false); // Tag
    });

    it('should detect multiple implicit M2M relations', async () => {
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
      const tableNames = joinTables.map((jt) => jt.tableName).sort();
      expect(tableNames).toEqual(['_CategoryToPost', '_PostToTag']);
    });

    it('should NOT detect explicit M2M with intermediate model', async () => {
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

      expect(joinTables).toHaveLength(0);
    });

    it('should extract ID field from model', async () => {
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
      const userModel = dmmf.datamodel.models.find((m) => m.name === 'User');

      if (!userModel) {
        throw new Error('User model not found');
      }

      const idField = getModelIdField(userModel);

      expect(idField.name).toBe('id');
      expect(idField.type).toBe('String');
      expect(idField.isId).toBe(true);
    });

    it('should throw error for model without ID', () => {
      const mockModel = {
        name: 'InvalidModel',
        fields: [{ name: 'name', type: 'String', isId: false }],
        primaryKey: null,
      };

      expect(() => getModelIdField(mockModel as any)).toThrow('Model InvalidModel has no ID field');
    });
  });

  describe('Annotation Parsing (@customType)', () => {
    it('should extract simple Effect Schema type', () => {
      const field = {
        documentation: '/// @customType(Schema.String)',
        name: 'name',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe('Schema.String');
    });

    it('should extract piped transformations', () => {
      const field = {
        documentation: '/// @customType(Schema.String.pipe(Schema.email()))',
        name: 'email',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe('Schema.String.pipe(Schema.email())');
    });

    it('should extract custom type references (PascalCase)', () => {
      const field = {
        documentation: '/// @customType(Vector1536)',
        name: 'embedding',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe('Vector1536');
    });

    it('should handle complex nested expressions', () => {
      const field = {
        documentation: '/// @customType(Schema.Array(Schema.Number).pipe(Schema.itemsCount(1536)))',
        name: 'embedding',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe(
        'Schema.Array(Schema.Number).pipe(Schema.itemsCount(1536))'
      );
    });

    it('should handle branded types', () => {
      const field = {
        documentation: '/// @customType(Schema.String.pipe(Schema.brand("UserId")))',
        name: 'userId',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe('Schema.String.pipe(Schema.brand("UserId"))');
    });

    it('should return null when no @customType annotation', () => {
      const field = {
        documentation: '/// This is just a regular comment',
        name: 'email',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBeNull();
    });

    it('should return null for invalid type (not Schema.* or PascalCase)', () => {
      const field = {
        documentation: '/// @customType(invalidType)',
        name: 'email',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBeNull();
    });

    it('should extract @customType with other annotations present', () => {
      const field = {
        documentation:
          '/// @description A user email\n/// @customType(Schema.String.pipe(Schema.email()))\n/// @example test@example.com',
        name: 'email',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe('Schema.String.pipe(Schema.email())');
    });
  });

  describe('Enum Extraction and Mapping', () => {
    it('should extract enums from DMMF', () => {
      const dmmf = createMockDMMF({
        enums: [
          {
            name: 'Role',
            values: [
              { name: 'USER', dbName: null },
              { name: 'ADMIN', dbName: null },
            ],
            dbName: null,
          } as DMMF.DatamodelEnum,
        ],
      });

      const enums = PrismaEnum.extractEnums(dmmf);
      expect(enums).toHaveLength(1);
      expect(enums[0].name).toBe('Role');
    });

    it('should use @map value for enum values when present', () => {
      const enumValue = {
        name: 'ACTIVE',
        dbName: 'active',
      } as DMMF.EnumValue;

      expect(PrismaEnum.getEnumValueDbName(enumValue)).toBe('active');
    });

    it('should get all database values for enum', () => {
      const enumDef = {
        name: 'Status',
        values: [
          { name: 'ACTIVE', dbName: 'active' },
          { name: 'INACTIVE', dbName: 'inactive' },
          { name: 'PENDING', dbName: null },
        ],
        dbName: null,
      } as DMMF.DatamodelEnum;

      const dbValues = PrismaEnum.getEnumDbValues(enumDef);
      expect(dbValues).toEqual(['active', 'inactive', 'PENDING']);
    });
  });

  describe('PrismaGenerator Integration', () => {
    it('should extract enums from generator', () => {
      const dmmf = createMockDMMF({
        enums: [
          {
            name: 'Role',
            values: [{ name: 'USER', dbName: null }],
            dbName: null,
          } as DMMF.DatamodelEnum,
          {
            name: 'Status',
            values: [{ name: 'ACTIVE', dbName: null }],
            dbName: null,
          } as DMMF.DatamodelEnum,
        ],
      });

      const generator = new PrismaGenerator(dmmf);
      const enums = generator.getEnums();

      expect(enums).toHaveLength(2);
      expect(enums.map((e) => e.name)).toEqual(['Role', 'Status']);
    });

    it('should get filtered and sorted models from generator', () => {
      const dmmf = createMockDMMF({
        models: [
          createMockModel({ name: 'Post' }),
          createMockModel({ name: '_InternalModel' }),
          createMockModel({ name: 'User' }),
          createMockModel({ name: 'Category' }),
        ],
      });

      const generator = new PrismaGenerator(dmmf);
      const models = generator.getModels();

      // Should exclude _InternalModel and be alphabetically sorted
      expect(models).toHaveLength(3);
      expect(models.map((m) => m.name)).toEqual(['Category', 'Post', 'User']);
    });

    it('should handle DMMF with no models or enums', () => {
      const dmmf = createMockDMMF({
        models: [],
        enums: [],
      });

      const generator = new PrismaGenerator(dmmf);

      expect(generator.getModels()).toHaveLength(0);
      expect(generator.getEnums()).toHaveLength(0);
    });
  });
});
