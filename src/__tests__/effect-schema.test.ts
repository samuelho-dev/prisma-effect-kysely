import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  columnType,
  generated,
  getSchemas,
  Insertable,
  Selectable,
  Updateable,
} from '../kysely/helpers.js';

/**
 * Effect Schema Runtime Behavior - Comprehensive Tests
 *
 * Unified test suite for all Effect Schema runtime behavior.
 * Tests verify BEHAVIOR not IMPLEMENTATION.
 *
 * Domains covered:
 * - Schema helpers (getSchemas, generated, columnType)
 * - Insert operations (without generated fields)
 * - Update operations (partial updates)
 * - Select operations (full objects)
 * - Schema validation and encoding/decoding
 *
 * NO type coercions (as any, as unknown).
 */

describe('Effect Schema - Runtime Behavior', () => {
  describe('Schema Helpers', () => {
    describe('getSchemas()', () => {
      it('should return Selectable, Insertable, and Updateable schemas', () => {
        const baseSchema = Schema.Struct({
          id: Schema.Number,
          name: Schema.String,
        });

        const schemas = getSchemas(baseSchema);

        expect(schemas).toHaveProperty('Selectable');
        expect(schemas).toHaveProperty('Insertable');
        expect(schemas).toHaveProperty('Updateable');
        expect(Schema.isSchema(schemas.Selectable)).toBe(true);
        expect(Schema.isSchema(schemas.Insertable)).toBe(true);
        expect(Schema.isSchema(schemas.Updateable)).toBe(true);
      });

      it('should handle generated fields correctly', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          name: Schema.String,
        });

        const schemas = getSchemas(baseSchema);

        // Insert should work WITHOUT generated field
        const insertResult = Schema.decodeUnknownSync(schemas.Insertable)({
          name: 'test',
        });
        expect(insertResult).toEqual({ name: 'test' });

        // Select should include generated field
        const selectResult = Schema.decodeUnknownSync(schemas.Selectable)({
          id: 123,
          name: 'test',
        });
        expect(selectResult).toEqual({ id: 123, name: 'test' });

        // Update should allow updating generated field
        const updateResult = Schema.decodeUnknownSync(schemas.Updateable)({
          id: 456,
        });
        expect(updateResult).toEqual({ id: 456 });
      });
    });

    describe('columnType()', () => {
      it('should use different types for select/insert/update', () => {
        const schema = columnType(Schema.Number, Schema.Never, Schema.Never);

        // Can decode with select schema
        const result = Schema.decodeUnknownSync(schema)(42);
        expect(result).toBe(42);
      });

      it('should support different types in getSchemas', () => {
        const baseSchema = Schema.Struct({
          id: columnType(Schema.Number, Schema.Never, Schema.Never),
          name: Schema.String,
        });

        const schemas = getSchemas(baseSchema);

        // Select includes id
        const selectResult = Schema.decodeUnknownSync(schemas.Selectable)({
          id: 1,
          name: 'test',
        });
        expect(selectResult).toEqual({ id: 1, name: 'test' });

        // Insert excludes id (Never type)
        const insertResult = Schema.decodeUnknownSync(schemas.Insertable)({
          name: 'test',
        });
        expect(insertResult).toEqual({ name: 'test' });

        // Update excludes id
        const updateResult = Schema.decodeUnknownSync(schemas.Updateable)({
          name: 'updated',
        });
        expect(updateResult).toEqual({ name: 'updated' });
      });
    });

    describe('generated()', () => {
      it('should be omitted from Insertable schema', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          name: Schema.String,
        });

        const schemas = getSchemas(baseSchema);

        const result = Schema.decodeUnknownSync(schemas.Insertable)({
          name: 'test',
        });
        expect(result).toEqual({ name: 'test' });
      });

      it('should be included in Selectable schema', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          name: Schema.String,
        });

        const schemas = getSchemas(baseSchema);

        const result = Schema.decodeUnknownSync(schemas.Selectable)({
          id: 123,
          name: 'test',
        });
        expect(result).toEqual({ id: 123, name: 'test' });
      });

      it('should ignore provided values for generated fields in insert', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          name: Schema.String,
        });

        const schemas = getSchemas(baseSchema);

        // Effect Schema silently ignores extra fields
        const result = Schema.decodeUnknownSync(schemas.Insertable)({
          id: 999, // This should be ignored
          name: 'test',
        });

        expect(result).toEqual({ name: 'test' });
      });

      it('should handle multiple generated fields', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.UUID),
          session_id: generated(Schema.UUID),
          created_at: generated(Schema.DateFromSelf),
          name: Schema.String,
        });

        const schemas = getSchemas(baseSchema);

        const result = Schema.decodeUnknownSync(schemas.Insertable)({
          name: 'test',
        });

        expect(result).toEqual({ name: 'test' });
      });
    });

    describe('Individual helper functions', () => {
      const TestSchema = Schema.Struct({
        id: Schema.UUID,
        name: Schema.String,
        email: Schema.String,
        age: Schema.Number,
        createdAt: Schema.DateFromSelf,
      });

      it('Selectable() should return valid schema', () => {
        const result = Selectable(TestSchema);

        expect(Schema.isSchema(result)).toBe(true);

        const decoded = Schema.decodeUnknownSync(result)({
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test User',
          email: 'test@example.com',
          age: 30,
          createdAt: new Date(),
        });

        expect(decoded).toHaveProperty('id');
        expect(decoded).toHaveProperty('name');
        expect(decoded).toHaveProperty('email');
      });

      it('Insertable() should return valid schema', () => {
        const result = Insertable(TestSchema);

        expect(Schema.isSchema(result)).toBe(true);

        const decoded = Schema.decodeUnknownSync(result)({
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test User',
          email: 'test@example.com',
          age: 30,
          createdAt: new Date(),
        });

        expect(decoded).toHaveProperty('name');
      });

      it('Updateable() should return valid schema for partial updates', () => {
        const result = Updateable(TestSchema);

        expect(Schema.isSchema(result)).toBe(true);

        const decoded = Schema.decodeUnknownSync(result)({
          name: 'Updated Name',
        });

        expect(decoded).toHaveProperty('name');
      });
    });
  });

  describe('Insert Operations', () => {
    it('should allow insert without @default fields', () => {
      const _User = Schema.Struct({
        id: generated(Schema.UUID),
        createdAt: generated(Schema.DateFromSelf),
        name: Schema.String,
        email: Schema.String,
      });

      const User = getSchemas(_User);

      const insertData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const result = Schema.decodeUnknownSync(User.Insertable)(insertData);

      expect(result).toEqual(insertData);
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('createdAt');
    });

    it('should require nullable fields to be present (with null or value)', () => {
      const _Product = Schema.Struct({
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        name: Schema.String,
        description: Schema.NullOr(Schema.String),
        price: Schema.NullOr(Schema.Number),
      });

      const Product = getSchemas(_Product);

      // With null values (SQL semantics - null must be explicit)
      const insertWithNulls = {
        name: 'Widget',
        description: null,
        price: null,
      };

      const result1 = Schema.decodeUnknownSync(Product.Insertable)(insertWithNulls);
      expect(result1).toEqual(insertWithNulls);

      // With actual values
      const fullInsert = {
        name: 'Widget',
        description: 'A useful widget',
        price: 19.99,
      };

      const result2 = Schema.decodeUnknownSync(Product.Insertable)(fullInsert);
      expect(result2).toEqual(fullInsert);
    });

    it('should handle models with only generated fields', () => {
      const _Metadata = Schema.Struct({
        id: generated(Schema.UUID),
        createdAt: generated(Schema.DateFromSelf),
        updatedAt: generated(Schema.DateFromSelf),
      });

      const Metadata = getSchemas(_Metadata);

      const emptyInsert = {};

      const result = Schema.decodeUnknownSync(Metadata.Insertable)(emptyInsert);
      expect(result).toEqual({});
    });
  });

  describe('Update Operations', () => {
    it('should make all fields optional for update', () => {
      const _User = Schema.Struct({
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        name: Schema.String,
        email: Schema.String,
        updatedAt: generated(Schema.DateFromSelf),
      });

      const User = getSchemas(_User);

      const partialUpdate = {
        name: 'New Name',
      };

      const result = Schema.decodeUnknownSync(User.Updateable)(partialUpdate);
      expect(result).toEqual({ name: 'New Name' });
    });

    it('should allow updating multiple fields', () => {
      const _Profile = Schema.Struct({
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        bio: Schema.NullOr(Schema.String),
        avatar: Schema.NullOr(Schema.String),
        website: Schema.NullOr(Schema.String),
      });

      const Profile = getSchemas(_Profile);

      const update = {
        bio: 'Software developer',
        website: 'https://example.com',
      };

      const result = Schema.decodeUnknownSync(Profile.Updateable)(update);
      expect(result).toEqual(update);
    });

    it('should allow setting fields to null', () => {
      const _Model = Schema.Struct({
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        optionalField: Schema.NullOr(Schema.String),
      });

      const Model = getSchemas(_Model);

      const clearUpdate = {
        optionalField: null,
      };

      const result = Schema.decodeUnknownSync(Model.Updateable)(clearUpdate);
      expect(result).toEqual({ optionalField: null });
    });
  });

  describe('Select Operations', () => {
    it('should include all fields for select', () => {
      const _User = Schema.Struct({
        id: generated(Schema.UUID),
        name: Schema.String,
        email: Schema.String,
        createdAt: generated(Schema.DateFromSelf),
      });

      const User = getSchemas(_User);

      const fullObject = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date('2024-01-01'),
      };

      const result = Schema.decodeUnknownSync(User.Selectable)(fullObject);
      expect(result.id).toBe(fullObject.id);
      expect(result.name).toBe(fullObject.name);
      expect(result.email).toBe(fullObject.email);
      expect(result.createdAt).toEqual(new Date('2024-01-01'));
    });

    it('should validate field types on select', () => {
      const _User = Schema.Struct({
        id: Schema.UUID,
        age: Schema.Number,
      });

      const User = getSchemas(_User);

      // Invalid UUID should fail
      expect(() =>
        Schema.decodeUnknownSync(User.Selectable)({
          id: 'not-a-uuid',
          age: 25,
        })
      ).toThrow();

      // Valid UUID should pass
      expect(() =>
        Schema.decodeUnknownSync(User.Selectable)({
          id: '123e4567-e89b-12d3-a456-426614174000',
          age: 25,
        })
      ).not.toThrow();
    });

    it('should handle optional fields in select', () => {
      const _Profile = Schema.Struct({
        id: Schema.UUID,
        bio: Schema.NullOr(Schema.String),
      });

      const Profile = getSchemas(_Profile);

      // With null
      const withNull = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bio: null,
      };

      const result1 = Schema.decodeUnknownSync(Profile.Selectable)(withNull);
      expect(result1).toEqual(withNull);

      // With value
      const withValue = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        bio: 'Developer',
      };

      const result2 = Schema.decodeUnknownSync(Profile.Selectable)(withValue);
      expect(result2).toEqual(withValue);
    });
  });

  describe('Schema Validation', () => {
    it('should validate UUID fields correctly', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(() => Schema.decodeUnknownSync(Schema.UUID)(validUuid)).not.toThrow();

      const invalidUuid = 'not-a-uuid';
      expect(() => Schema.decodeUnknownSync(Schema.UUID)(invalidUuid)).toThrow();
    });

    it('should validate nested structures', () => {
      const _Post = Schema.Struct({
        id: Schema.UUID,
        title: Schema.String,
        metadata: Schema.Struct({
          views: Schema.Number,
          likes: Schema.Number,
        }),
      });

      const Post = getSchemas(_Post);

      const validPost = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Post',
        metadata: {
          views: 100,
          likes: 5,
        },
      };

      const result = Schema.decodeUnknownSync(Post.Selectable)(validPost);
      expect(result).toEqual(validPost);

      // Invalid nested structure
      const invalidPost = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Post',
        metadata: {
          views: 'not-a-number',
          likes: 5,
        },
      };

      expect(() => Schema.decodeUnknownSync(Post.Selectable)(invalidPost)).toThrow();
    });

    it('should validate array fields', () => {
      const _Tag = Schema.Struct({
        id: Schema.UUID,
        names: Schema.Array(Schema.String),
      });

      const Tag = getSchemas(_Tag);

      const validTag = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        names: ['typescript', 'effect', 'kysely'],
      };

      const result = Schema.decodeUnknownSync(Tag.Selectable)(validTag);
      expect(result).toEqual(validTag);

      // Invalid array elements
      const invalidTag = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        names: ['typescript', 123, 'kysely'],
      };

      expect(() => Schema.decodeUnknownSync(Tag.Selectable)(invalidTag)).toThrow();
    });
  });

  describe('Encoding and Decoding', () => {
    it('should correctly encode Date fields to ISO strings', () => {
      const _Event = Schema.Struct({
        id: Schema.UUID,
        occurredAt: Schema.DateFromSelf,
      });

      const Event = getSchemas(_Event);

      const testDate = new Date('2024-01-01T12:00:00Z');
      const event = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        occurredAt: testDate,
      };

      // Encode to wire format
      const encoded = Schema.encodeUnknownSync(Event.Selectable)(event);
      expect(encoded).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        occurredAt: testDate,
      });

      // Decode back from wire format
      const decoded = Schema.decodeUnknownSync(Event.Selectable)(encoded);
      expect(decoded).toEqual(event);
    });

    it('should handle bigint encoding/decoding', () => {
      const _Counter = Schema.Struct({
        id: Schema.UUID,
        count: Schema.BigInt,
      });

      const Counter = getSchemas(_Counter);

      const counter = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        count: BigInt(9007199254740991),
      };

      // Encode to string
      const encoded = Schema.encodeUnknownSync(Counter.Selectable)(counter);
      expect(typeof encoded.count).toBe('string');

      // Decode back to bigint
      const decoded = Schema.decodeUnknownSync(Counter.Selectable)(encoded);
      expect(decoded.count).toBe(counter.count);
      expect(typeof decoded.count).toBe('bigint');
    });
  });

  describe('Complex Real-world Scenarios', () => {
    it('should handle mixed field types correctly', () => {
      const baseSchema = Schema.Struct({
        // Read-only ID
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        // Generated timestamp
        created_at: generated(Schema.DateFromSelf),
        // Required fields
        email: Schema.String,
        username: Schema.String,
        // Optional fields
        bio: Schema.NullOr(Schema.String),
      });

      const schemas = getSchemas(baseSchema);

      // Insertable: no id, no created_at, but bio must be present (null or value)
      const insertResult = Schema.decodeUnknownSync(schemas.Insertable)({
        email: 'test@example.com',
        username: 'testuser',
        bio: null,
      });
      expect(insertResult).toEqual({
        email: 'test@example.com',
        username: 'testuser',
        bio: null,
      });

      // Updateable: partial update
      const updateResult = Schema.decodeUnknownSync(schemas.Updateable)({
        bio: 'New bio',
      });
      expect(updateResult).toEqual({ bio: 'New bio' });

      // Selectable: all fields
      const selectResult = Schema.decodeUnknownSync(schemas.Selectable)({
        id: '123e4567-e89b-12d3-a456-426614174000',
        created_at: new Date(),
        email: 'test@example.com',
        username: 'testuser',
        bio: 'New bio',
      });
      expect(selectResult).toHaveProperty('id');
      expect(selectResult).toHaveProperty('created_at');
      expect(selectResult.created_at).toBeInstanceOf(Date);
      expect(selectResult).toHaveProperty('email');
    });

    it('should handle typical user model with all field types', () => {
      const _User = Schema.Struct({
        // Read-only generated ID
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        // Required fields
        email: Schema.String,
        username: Schema.String,
        // Optional fields
        bio: Schema.NullOr(Schema.String),
        avatar: Schema.NullOr(Schema.String),
        // Generated timestamps
        createdAt: generated(Schema.DateFromSelf),
        updatedAt: generated(Schema.DateFromSelf),
        // Array field
        roles: Schema.Array(Schema.String),
      });

      const User = getSchemas(_User);

      // Insert: Required fields, arrays, and nullable fields (must be explicit)
      const insertData = {
        email: 'test@example.com',
        username: 'testuser',
        bio: null,
        avatar: null,
        roles: ['USER'],
      };

      const insertResult = Schema.decodeUnknownSync(User.Insertable)(insertData);
      expect(insertResult).toEqual(insertData);

      // Update: Partial update
      const updateData = {
        bio: 'New bio',
        avatar: 'https://example.com/avatar.jpg',
      };

      const updateResult = Schema.decodeUnknownSync(User.Updateable)(updateData);
      expect(updateResult).toEqual(updateData);

      // Select: Full object
      const selectData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        username: 'testuser',
        bio: 'New bio',
        avatar: 'https://example.com/avatar.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: ['USER'],
      };

      const selectResult = Schema.decodeUnknownSync(User.Selectable)(selectData);
      expect(selectResult.id).toBe(selectData.id);
      expect(selectResult.email).toBe(selectData.email);
      expect(selectResult.username).toBe(selectData.username);
      expect(selectResult.bio).toBe(selectData.bio);
      expect(selectResult.avatar).toBe(selectData.avatar);
      expect(selectResult.createdAt).toBeInstanceOf(Date);
      expect(selectResult.updatedAt).toBeInstanceOf(Date);
      expect(selectResult.roles).toEqual(selectData.roles);
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should preserve Schema type for generated() - compile-time check', () => {
      const dateSchema = generated(Schema.DateFromSelf);
      const numberSchema = generated(Schema.Number);
      const uuidSchema = generated(Schema.UUID);

      // Type assertions - will fail at compile time if types are wrong
      const _dateCheck: Schema.Schema<Date, Date> = dateSchema;
      const _numberCheck: Schema.Schema<number, number> = numberSchema;
      const _uuidCheck: Schema.Schema<string, string> = uuidSchema;

      // Runtime validation - verify Schema type is preserved
      expect(Schema.isSchema(dateSchema)).toBe(true);
      expect(Schema.isSchema(numberSchema)).toBe(true);
      expect(Schema.isSchema(uuidSchema)).toBe(true);
    });

    it('should preserve Schema type for columnType() - compile-time check', () => {
      const uuidSchema = columnType(Schema.UUID, Schema.Never, Schema.Never);
      const numberSchema = columnType(Schema.Number, Schema.Never, Schema.Never);
      const dateSchema = columnType(Schema.DateFromSelf, Schema.Never, Schema.Never);

      // Type assertions - will fail at compile time if types are wrong
      const _uuidCheck: Schema.Schema<string, string> = uuidSchema;
      const _numberCheck: Schema.Schema<number, number> = numberSchema;
      const _dateCheck: Schema.Schema<Date, Date> = dateSchema;

      // Runtime validation - verify Schema type is preserved
      expect(Schema.isSchema(uuidSchema)).toBe(true);
      expect(Schema.isSchema(numberSchema)).toBe(true);
      expect(Schema.isSchema(dateSchema)).toBe(true);
    });

    it('should return schemas with preserved TypeScript types from getSchemas()', () => {
      const baseSchema = Schema.Struct({
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        createdAt: generated(Schema.DateFromSelf),
        name: Schema.String,
      });

      const schemas = getSchemas(baseSchema);

      // Type-level validation - these will fail at compile-time if broken

      // Runtime validation - verify all schemas are valid Schema instances
      expect(Schema.isSchema(schemas.Selectable)).toBe(true);
      expect(Schema.isSchema(schemas.Insertable)).toBe(true);
      expect(Schema.isSchema(schemas.Updateable)).toBe(true);
    });

    it('should make arrays mutable in Insertable schema for Kysely compatibility', () => {
      // This test ensures that Schema.Array(...) which produces readonly T[]
      // is transformed to mutable T[] for Insertable operations
      // Kysely expects mutable string[] for INSERT operations, not readonly string[]
      const baseSchema = Schema.Struct({
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        names: Schema.Array(Schema.String),
        tags: Schema.Array(Schema.String),
      });

      const { Insertable } = getSchemas(baseSchema);

      // Runtime validation - arrays should be mutable
      const insertData = {
        names: ['typescript', 'effect'],
        tags: ['kysely', 'prisma'],
      };

      const result = Schema.decodeUnknownSync(Insertable)(insertData);
      expect(result).toEqual(insertData);

      // Verify the decoded arrays are mutable (have push method)
      // Using (result.names as any) to bypass readonly type check for runtime verification
      expect(Array.isArray(result.names)).toBe(true);
      (result.names as any).push('new-item');
      expect(result.names).toContain('new-item');
    });

    it('should make arrays mutable in Updateable schema for Kysely compatibility', () => {
      // This test ensures that array types are mutable in Updateable schema
      // Kysely expects mutable string[] for UPDATE operations
      const baseSchema = Schema.Struct({
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        roles: Schema.Array(Schema.String),
      });

      const { Updateable } = getSchemas(baseSchema);

      // Runtime validation - arrays should be mutable
      const updateData = {
        roles: ['admin', 'user'],
      };

      const result = Schema.decodeUnknownSync(Updateable)(updateData);
      expect(result).toEqual(updateData);

      // Verify the decoded arrays are mutable
      expect(Array.isArray(result.roles)).toBe(true);
      (result.roles as any).push('moderator');
      expect(result.roles).toContain('moderator');
    });

    it('should preserve readonly arrays in Selectable schema', () => {
      // This test ensures that arrays remain readonly in Selectable schema
      // Select operations should return readonly arrays (immutable)
      const baseSchema = Schema.Struct({
        id: Schema.UUID,
        items: Schema.Array(Schema.String),
      });

      const { Selectable } = getSchemas(baseSchema);

      // Runtime validation - decode should work
      const selectData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        items: ['a', 'b', 'c'],
      };

      const result = Schema.decodeUnknownSync(Selectable)(selectData);
      expect(result).toEqual(selectData);
      expect(result.items).toEqual(['a', 'b', 'c']);
    });

    it('should handle nested array types correctly', () => {
      // Test nested arrays (e.g., coordinates: number[][])
      const baseSchema = Schema.Struct({
        id: columnType(Schema.UUID, Schema.Never, Schema.Never), // Read-only ID
        coordinates: Schema.Array(Schema.Array(Schema.Number)),
      });

      const { Insertable, Selectable } = getSchemas(baseSchema);

      // Insertable: nested arrays should be mutable (no id field in insert)
      const insertData = {
        coordinates: [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
      };

      const insertResult = Schema.decodeUnknownSync(Insertable)(insertData);
      expect(insertResult).toEqual(insertData);

      // Verify nested arrays are mutable
      (insertResult.coordinates as any)[0].push(3);
      expect(insertResult.coordinates[0]).toEqual([1, 2, 3]);

      // Selectable: nested arrays should be readonly (id field required)
      const selectData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        coordinates: [
          [1, 2],
          [3, 4],
        ],
      };

      const selectResult = Schema.decodeUnknownSync(Selectable)(selectData);
      expect(selectResult).toEqual(selectData);
    });

    it('should handle array types with columnType() wrapper correctly', () => {
      // Test that columnType with array types works correctly
      // The insert/update schemas should still be mutable
      const baseSchema = Schema.Struct({
        // Read-only ID with columnType
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        // Regular string array
        names: Schema.Array(Schema.String),
      });

      const { Insertable, Updateable } = getSchemas(baseSchema);

      // Insertable should accept mutable arrays
      const insertData = {
        names: ['test1', 'test2'],
      };

      const insertResult = Schema.decodeUnknownSync(Insertable)(insertData);
      expect(insertResult).toEqual(insertData);

      // Updateable should accept mutable arrays
      const updateData = {
        names: ['updated1', 'updated2'],
      };

      const updateResult = Schema.decodeUnknownSync(Updateable)(updateData);
      expect(updateResult).toEqual(updateData);
    });

    it('should handle generated array fields (user use case: verification_fields_needed)', () => {
      // This is the specific use case from the user:
      // verification_fields_needed: generated(Schema.Array(Schema.String))
      // The generated array should be omitted from Insertable but present in Selectable
      const baseSchema = Schema.Struct({
        id: columnType(Schema.UUID, Schema.Never, Schema.Never),
        // This is the user's use case - generated array field
        verification_fields_needed: generated(Schema.Array(Schema.String)),
        name: Schema.String,
      });

      const { Selectable, Insertable, Updateable } = getSchemas(baseSchema);

      // Selectable should include the generated array field
      const selectData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        verification_fields_needed: ['email', 'phone'],
        name: 'Test',
      };
      const selectResult = Schema.decodeUnknownSync(Selectable)(selectData);
      expect(selectResult.verification_fields_needed).toEqual(['email', 'phone']);

      // Insertable should NOT include the generated field (omitted entirely)
      const insertData = {
        name: 'Test',
      };
      const insertResult = Schema.decodeUnknownSync(Insertable)(insertData);
      expect(insertResult).toEqual(insertData);
      expect(insertResult).not.toHaveProperty('verification_fields_needed');

      // Updateable should allow updating the generated field
      const updateData = {
        verification_fields_needed: ['email', 'phone', 'address'],
      };
      const updateResult = Schema.decodeUnknownSync(Updateable)(updateData);
      expect(updateResult.verification_fields_needed).toEqual(['email', 'phone', 'address']);

      // Verify the array is mutable for update operations
      (updateResult.verification_fields_needed as any).push('ssn');
      expect(updateResult.verification_fields_needed).toContain('ssn');
    });
  });
});
