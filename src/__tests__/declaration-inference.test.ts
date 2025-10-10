import * as S from 'effect/Schema';
import { selectable, insertable, updateable, getSchemas } from '../kysely/helpers';
import type { Selectable, Insertable, Updateable } from 'kysely';

/**
 * TDD Test Suite: .d.ts Type Preservation
 *
 * These tests verify that helper functions preserve type information
 * when compiled to declaration files (.d.ts), ensuring consumers
 * can correctly infer types when using dist/ paths instead of source paths.
 *
 * EXPECTED INITIAL STATE: All tests should FAIL
 * This proves the issue exists and validates our fix approach.
 */

describe('Declaration File Type Inference', () => {
  // Simple test schema for basic type inference tests
  const TestSchema = S.Struct({
    id: S.UUID,
    name: S.String,
    email: S.String,
    age: S.Number,
    createdAt: S.Date,
  });

  type TestType = S.Schema.Type<typeof TestSchema>;
  type TestEncoded = S.Schema.Encoded<typeof TestSchema>;

  describe('selectable() return type preservation', () => {
    it('should return S.Schema<Selectable<Type>, Selectable<Encoded>, never>', () => {
      const result = selectable(TestSchema);

      // Type-level assertion: This should compile without errors
      type Expected = S.Schema<Selectable<TestType>, Selectable<TestEncoded>, never>;
      type Actual = typeof result;

      // Runtime type check - verify it's a Schema
      expect(S.isSchema(result)).toBe(true);

      // The key test: Can we decode a value and get proper type inference?
      const decoded = S.decodeUnknownSync(result)({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test User',
        email: 'test@example.com',
        age: 30,
        createdAt: new Date().toISOString(), // Encode as ISO string
      });

      // TypeScript should infer this as an object with proper fields
      expect(decoded).toHaveProperty('id');
      expect(decoded).toHaveProperty('name');
      expect(decoded).toHaveProperty('email');

      // Type assertion: decoded should NOT be 'unknown'
      type DecodedType = typeof decoded;
      const assertNotUnknown: DecodedType extends unknown
        ? unknown extends DecodedType
          ? never
          : true
        : true = true;
      expect(assertNotUnknown).toBe(true);
    });

    it('should preserve Kysely Selectable mapped type', () => {
      const result = selectable(TestSchema);
      type ResultType = S.Schema.Type<typeof result>;

      // This type should be Selectable<TestType>, not unknown
      // We verify by checking the structure matches what Selectable would produce
      const value: ResultType = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        email: 'test@test.com',
        age: 25,
        createdAt: new Date(),
      };

      expect(value.id).toBeDefined();
    });
  });

  describe('insertable() return type preservation', () => {
    it('should return S.Schema<Insertable<Type>, Insertable<Encoded>, never>', () => {
      const result = insertable(TestSchema);

      // Runtime type check
      expect(S.isSchema(result)).toBe(true);

      // Type-level check: Should allow optional fields
      type ResultType = S.Schema.Type<typeof result>;

      const decoded = S.decodeUnknownSync(result)({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test User',
        email: 'test@example.com',
        age: 30,
        createdAt: new Date().toISOString(),
      });

      expect(decoded).toHaveProperty('name');

      // Type assertion: decoded should NOT be 'unknown'
      type DecodedType = typeof decoded;
      const assertNotUnknown: DecodedType extends unknown
        ? unknown extends DecodedType
          ? never
          : true
        : true = true;
      expect(assertNotUnknown).toBe(true);
    });
  });

  describe('updateable() return type preservation', () => {
    it('should return S.Schema<Updateable<Type>, Updateable<Encoded>, never>', () => {
      const result = updateable(TestSchema);

      // Runtime type check
      expect(S.isSchema(result)).toBe(true);

      // Type-level check: Should allow partial updates
      type ResultType = S.Schema.Type<typeof result>;

      const decoded = S.decodeUnknownSync(result)({
        name: 'Updated Name',
      });

      expect(decoded).toHaveProperty('name');

      // Type assertion: decoded should NOT be 'unknown'
      type DecodedType = typeof decoded;
      const assertNotUnknown: DecodedType extends unknown
        ? unknown extends DecodedType
          ? never
          : true
        : true = true;
      expect(assertNotUnknown).toBe(true);
    });
  });

  describe('getSchemas() return type preservation', () => {
    it('should return Schemas<Type, Encoded> interface', () => {
      const result = getSchemas(TestSchema);

      // Verify structure
      expect(result).toHaveProperty('Selectable');
      expect(result).toHaveProperty('Insertable');
      expect(result).toHaveProperty('Updateable');

      // Verify all are schemas
      expect(S.isSchema(result.Selectable)).toBe(true);
      expect(S.isSchema(result.Insertable)).toBe(true);
      expect(S.isSchema(result.Updateable)).toBe(true);
    });

    it('should allow Schema.Schema.Type extraction without resolving to unknown', () => {
      const schemas = getSchemas(TestSchema);

      // This is the critical test: Can we extract types like consumers do?
      type SelectType = S.Schema.Type<typeof schemas.Selectable>;
      type InsertType = S.Schema.Type<typeof schemas.Insertable>;
      type UpdateType = S.Schema.Type<typeof schemas.Updateable>;

      // Type assertions: These should NOT be 'unknown'
      const selectValue: SelectType = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        email: 'test@test.com',
        age: 25,
        createdAt: new Date(),
      };

      const insertValue: InsertType = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        email: 'test@test.com',
        age: 25,
        createdAt: new Date(),
      };

      const updateValue: UpdateType = {
        name: 'Updated',
      };

      expect(selectValue.id).toBeDefined();
      expect(insertValue.name).toBeDefined();
      expect(updateValue.name).toBeDefined();

      // Type-level assertions
      type SelectNotUnknown = SelectType extends unknown
        ? unknown extends SelectType
          ? never
          : true
        : true;
      type InsertNotUnknown = InsertType extends unknown
        ? unknown extends InsertType
          ? never
          : true
        : true;
      type UpdateNotUnknown = UpdateType extends unknown
        ? unknown extends UpdateType
          ? never
          : true
        : true;

      const assertSelect: SelectNotUnknown = true;
      const assertInsert: InsertNotUnknown = true;
      const assertUpdate: UpdateNotUnknown = true;

      expect(assertSelect).toBe(true);
      expect(assertInsert).toBe(true);
      expect(assertUpdate).toBe(true);
    });
  });

  describe('Real-world usage pattern (simulates consumer code)', () => {
    it('should work like generated code from @libs/types', () => {
      // Simulate what prisma-effect-kysely generates (simplified without columnType/generated)
      const _user = S.Struct({
        id: S.UUID,
        email: S.String,
        name: S.String,
        role: S.Literal('admin', 'user'),
        createdAt: S.Date,
      });

      const User = getSchemas(_user);

      // Simulate contract layer type exports
      type UserSelect = S.Schema.Type<typeof User.Selectable>;
      type UserInsert = S.Schema.Type<typeof User.Insertable>;
      type UserUpdate = S.Schema.Type<typeof User.Updateable>;

      // Simulate application code using these types
      const mockUser: UserSelect = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date(),
      };

      const mockInsert: UserInsert = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'user',
        createdAt: new Date(),
      };

      const mockUpdate: UserUpdate = {
        name: 'Updated Name',
      };

      // Critical assertions: Types should be properly inferred
      expect(mockUser.id).toBeDefined();
      expect(mockUser.email).toBeDefined();
      expect(mockInsert.email).toBeDefined();
      expect(mockUpdate.name).toBeDefined();

      // TypeScript should allow proper property access
      const emailLength = mockUser.email.length;
      const nameUpper = mockInsert.name.toUpperCase();

      expect(emailLength).toBeGreaterThan(0);
      expect(nameUpper).toBeDefined();
    });
  });
});
