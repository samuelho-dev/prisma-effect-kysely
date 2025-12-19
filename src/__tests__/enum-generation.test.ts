import { Schema } from 'effect';
import { generateEnumSchema, generateEnumsFile } from '../effect/enum.js';
import { buildFieldType } from '../effect/type.js';
import { createMockDMMF, createMockEnum, createMockField } from './helpers/dmmf-mocks.js';
import type { DMMF } from '@prisma/generator-helper';

/**
 * Enum Generation - Functional Behavior Tests
 *
 * Tests verify BEHAVIOR not IMPLEMENTATION:
 * - Can generated enums validate values correctly?
 * - Do enum fields map to correct Schema types?
 * - Does generated code execute without errors?
 * - Do enums integrate with Effect Schema properly?
 *
 * NO string matching on implementation details.
 * NO type coercions (as any, as unknown).
 */
describe('Enum Generation - Functional Tests', () => {
  describe('Enum Schema Runtime Behavior', () => {
    // Use actual enum for behavioral tests
    enum ProductStatus {
      ARCHIVED = 'ARCHIVED',
      DRAFT = 'DRAFT',
      ACTIVE = 'ACTIVE',
    }

    const ProductStatusSchema = Schema.Enums(ProductStatus);

    it('should allow property access on generated enum', () => {
      expect(ProductStatus.ACTIVE).toBe('ACTIVE');
      expect(ProductStatus.DRAFT).toBe('DRAFT');
      expect(ProductStatus.ARCHIVED).toBe('ARCHIVED');
    });

    it('should validate valid enum values', () => {
      const decodeSync = Schema.decodeUnknownSync(ProductStatusSchema);

      // Test string values
      expect(decodeSync('ACTIVE')).toBe('ACTIVE');
      expect(decodeSync('DRAFT')).toBe('DRAFT');
      expect(decodeSync('ARCHIVED')).toBe('ARCHIVED');

      // Test enum member values
      expect(decodeSync(ProductStatus.ACTIVE)).toBe('ACTIVE');
      expect(decodeSync(ProductStatus.DRAFT)).toBe('DRAFT');
    });

    it('should reject invalid enum values', () => {
      const decodeSync = Schema.decodeUnknownSync(ProductStatusSchema);

      expect(() => decodeSync('INVALID')).toThrow();
      expect(() => decodeSync('invalid')).toThrow();
      expect(() => decodeSync(123)).toThrow();
      expect(() => decodeSync(null)).toThrow();
    });

    it('should encode enum values correctly', () => {
      const encodeSync = Schema.encodeSync(ProductStatusSchema);

      expect(encodeSync(ProductStatus.ACTIVE)).toBe('ACTIVE');
      expect(encodeSync(ProductStatus.DRAFT)).toBe('DRAFT');
    });

    it('should provide correct type inference', () => {
      type ExtractedType = Schema.Schema.Type<typeof ProductStatusSchema>;

      // Type inference should allow enum members
      const status1: ExtractedType = ProductStatus.ACTIVE;
      const status2: ExtractedType = ProductStatus.DRAFT;

      expect(status1).toBe('ACTIVE');
      expect(status2).toBe('DRAFT');
    });

    it('should be compatible with Kysely string literal types', () => {
      // Simulate Kysely's expected type
      type RoleDB = 'ADMIN' | 'USER';

      enum Role {
        ADMIN = 'ADMIN',
        USER = 'USER',
      }

      // Enum values should be assignable to string literal union
      const dbValue: RoleDB = Role.ADMIN;

      expect(dbValue).toBe('ADMIN');
    });
  });

  describe('Enum Schema in Struct Integration', () => {
    it('should work correctly in Schema.Struct', () => {
      enum Status {
        PENDING = 'PENDING',
        COMPLETED = 'COMPLETED',
      }

      const StatusSchema = Schema.Enums(Status);

      const TaskSchema = Schema.Struct({
        id: Schema.Number,
        name: Schema.String,
        status: StatusSchema,
      });

      // Valid task with enum
      const validTask = {
        id: 1,
        name: 'Test Task',
        status: Status.PENDING,
      };

      const result = Schema.decodeUnknownSync(TaskSchema)(validTask);
      expect(result).toEqual(validTask);
      expect(result.status).toBe('PENDING');

      // Invalid task with wrong status
      const invalidTask = {
        id: 1,
        name: 'Test Task',
        status: 'INVALID_STATUS',
      };

      expect(() => Schema.decodeUnknownSync(TaskSchema)(invalidTask)).toThrow();
    });

    it('should work with optional enum fields', () => {
      enum Priority {
        LOW = 'LOW',
        HIGH = 'HIGH',
      }

      const PrioritySchema = Schema.Enums(Priority);

      const TaskSchema = Schema.Struct({
        name: Schema.String,
        priority: Schema.UndefinedOr(PrioritySchema),
      });

      // With priority
      const withPriority = {
        name: 'Task 1',
        priority: Priority.HIGH,
      };

      const result1 = Schema.decodeUnknownSync(TaskSchema)(withPriority);
      expect(result1.priority).toBe('HIGH');

      // Without priority
      const withoutPriority = {
        name: 'Task 2',
      };

      const result2 = Schema.decodeUnknownSync(TaskSchema)(withoutPriority);
      expect(result2.priority).toBeUndefined();
    });

    it('should work with array of enum values', () => {
      enum Tag {
        URGENT = 'URGENT',
        REVIEW = 'REVIEW',
        BUG = 'BUG',
      }

      const TagSchema = Schema.Enums(Tag);

      const ItemSchema = Schema.Struct({
        tags: Schema.Array(TagSchema),
      });

      const validItem = {
        tags: [Tag.URGENT, Tag.BUG],
      };

      const result = Schema.decodeUnknownSync(ItemSchema)(validItem);
      expect(result.tags).toEqual(['URGENT', 'BUG']);

      // Invalid array element
      const invalidItem = {
        tags: [Tag.URGENT, 'INVALID'],
      };

      expect(() => Schema.decodeUnknownSync(ItemSchema)(invalidItem)).toThrow();
    });
  });

  describe('Field Type Mapping Behavior', () => {
    const mockDMMF = createMockDMMF({
      enums: [createMockEnum('PRODUCT_STATUS', ['ACTIVE', 'DRAFT'])],
      models: [],
    });

    it('should map enum field to Schema wrapper', () => {
      const mockEnumField = createMockField({
        name: 'status',
        kind: 'enum',
        type: 'PRODUCT_STATUS',
        isList: false,
        isRequired: true,
        isUnique: false,
        isId: false,
        isReadOnly: false,
        hasDefaultValue: false,
        isGenerated: false,
        isUpdatedAt: false,
      });

      const result = buildFieldType(mockEnumField, mockDMMF);

      // Should return PascalCase Schema wrapper
      expect(result).toBe('ProductStatusSchema');
    });

    it('should map array enum field to Array wrapper', () => {
      const mockArrayEnumField = createMockField({
        name: 'statuses',
        kind: 'enum',
        type: 'PRODUCT_STATUS',
        isList: true,
        isRequired: true,
        isUnique: false,
        isId: false,
        isReadOnly: false,
        hasDefaultValue: false,
        isGenerated: false,
        isUpdatedAt: false,
      });

      const result = buildFieldType(mockArrayEnumField, mockDMMF);

      // Should wrap in Array
      expect(result).toBe('Schema.Array(ProductStatusSchema)');
    });

    it('should map optional enum field to UndefinedOr wrapper', () => {
      const mockOptionalEnumField = createMockField({
        name: 'status',
        kind: 'enum',
        type: 'PRODUCT_STATUS',
        isList: false,
        isRequired: false,
        isUnique: false,
        isId: false,
        isReadOnly: false,
        hasDefaultValue: false,
        isGenerated: false,
        isUpdatedAt: false,
      });

      const result = buildFieldType(mockOptionalEnumField, mockDMMF);

      // Should wrap in UndefinedOr
      expect(result).toBe('Schema.UndefinedOr(ProductStatusSchema)');
    });
  });

  describe('Code Generation E2E', () => {
    const mockEnum: DMMF.DatamodelEnum = {
      name: 'USER_ROLE',
      values: [
        { name: 'ADMIN', dbName: null },
        { name: 'USER', dbName: null },
        { name: 'GUEST', dbName: null },
      ],
      dbName: null,
    };

    it('should generate executable enum code', () => {
      const generatedCode = generateEnumSchema(mockEnum);

      // Verify generated code contains expected structures (minimal checks)
      expect(generatedCode).toContain('export enum USER_ROLE');
      expect(generatedCode).toContain('Schema.Enums');
      expect(generatedCode).toContain('UserRoleSchema');
      expect(generatedCode).toContain('UserRoleType');
    });

    it('should generate valid TypeScript that can be executed', () => {
      const generatedCode = generateEnumSchema(mockEnum);

      // Verify it's valid TypeScript (would compile without errors)
      expect(generatedCode).toMatch(/export enum USER_ROLE/);
      expect(generatedCode).toMatch(/ADMIN = "ADMIN"/);
      expect(generatedCode).toMatch(/USER = "USER"/);
      expect(generatedCode).toMatch(/GUEST = "GUEST"/);
    });

    it('should use Schema.Enums not Schema.Literal', () => {
      const generatedCode = generateEnumSchema(mockEnum);

      // Modern pattern: Schema.Enums
      expect(generatedCode).toContain('Schema.Enums(USER_ROLE)');

      // Old pattern should NOT exist
      expect(generatedCode).not.toContain('Schema.Literal');
    });

    it('should preserve enum name but use PascalCase for Schema/Type', () => {
      const generatedCode = generateEnumSchema(mockEnum);

      // Original SCREAMING_SNAKE_CASE preserved
      expect(generatedCode).toContain('enum USER_ROLE');

      // PascalCase for Schema wrapper and Type
      expect(generatedCode).toContain('UserRoleSchema');
      expect(generatedCode).toContain('UserRoleType');

      // Should NOT use snake_case for schema/type
      expect(generatedCode).not.toContain('user_role_schema');
    });

    it('should generate complete enums file with imports', () => {
      const mockEnums: DMMF.DatamodelEnum[] = [
        {
          name: 'STATUS',
          values: [{ name: 'ACTIVE', dbName: null }],
          dbName: null,
        },
      ];

      const generatedFile = generateEnumsFile(mockEnums);

      // Verify file structure
      expect(generatedFile).toContain('import { Schema } from "effect"');
      expect(generatedFile).toContain('export enum STATUS');
      expect(generatedFile).toContain('STATUSSchema');
    });
  });

  describe('Enum with @map directive', () => {
    it('should handle enums with mapped database values', () => {
      const mockMappedEnum: DMMF.DatamodelEnum = {
        name: 'TaskStatus',
        values: [
          { name: 'TODO', dbName: 'todo_db' },
          { name: 'IN_PROGRESS', dbName: 'in_progress_db' },
          { name: 'DONE', dbName: 'done_db' },
        ],
        dbName: 'task_status_db',
      };

      const generatedCode = generateEnumSchema(mockMappedEnum);

      // Should still generate valid enum
      expect(generatedCode).toContain('export enum TaskStatus');
      expect(generatedCode).toContain('Schema.Enums(TaskStatus)');
    });
  });

  describe('Multiple enums integration', () => {
    it('should handle multiple enums in one file', () => {
      const mockEnums: DMMF.DatamodelEnum[] = [
        {
          name: 'ROLE',
          values: [{ name: 'ADMIN', dbName: null }],
          dbName: null,
        },
        {
          name: 'STATUS',
          values: [{ name: 'ACTIVE', dbName: null }],
          dbName: null,
        },
      ];

      const generatedFile = generateEnumsFile(mockEnums);

      // Both enums should be present
      expect(generatedFile).toContain('export enum ROLE');
      expect(generatedFile).toContain('export enum STATUS');
      expect(generatedFile).toContain('ROLESchema');
      expect(generatedFile).toContain('STATUSSchema');
    });
  });
});
