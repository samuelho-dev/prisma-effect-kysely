import { Schema } from 'effect';
import * as AST from 'effect/SchemaAST';
import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  columnType,
  generated,
  getSchemas,
  Insertable,
  Updateable,
  Selectable,
  Id,
  type SchemasWithId,
} from '../kysely/helpers.js';

/**
 * Test that type utilities work with exactOptionalPropertyTypes: true
 * These are compile-time tests - if they compile, the test passes
 */
describe('exactOptionalPropertyTypes compatibility', () => {
  it('should work with SchemasWithId type', () => {
    const _Transaction = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      amount: Schema.Number,
      description: Schema.String,
    });
    const TransactionIdSchema = Schema.UUID.pipe(Schema.brand('TransactionId'));

    const Transaction = getSchemas(_Transaction, TransactionIdSchema);

    // These type aliases must compile under exactOptionalPropertyTypes: true
    type Order = Selectable<typeof Transaction>;
    type OrderInsert = Insertable<typeof Transaction>;
    type OrderUpdate = Updateable<typeof Transaction>;
    type OrderId = Id<typeof Transaction>;

    // Also test the direct Schema access pattern
    type _OrderDirect = Schema.Schema.Type<typeof Transaction.Selectable>;
    type _OrderInsertDirect = Schema.Schema.Type<typeof Transaction.Insertable>;

    // Type-level assertions verify correct field inclusion/exclusion
    expectTypeOf<Order>().toHaveProperty('id');
    expectTypeOf<Order>().toHaveProperty('amount');
    expectTypeOf<OrderInsert>().not.toHaveProperty('id');
    expectTypeOf<OrderInsert>().toHaveProperty('amount');
    expectTypeOf<OrderUpdate>().not.toHaveProperty('id');
    expectTypeOf<OrderId>().toBeString();
  });

  it('should work with Schemas type (no Id)', () => {
    const _Post = Schema.Struct({
      title: Schema.String,
      content: Schema.String,
    });

    const Post = getSchemas(_Post);

    // These type aliases must compile under exactOptionalPropertyTypes: true
    type PostSelect = Selectable<typeof Post>;
    type PostInsert = Insertable<typeof Post>;
    type _PostUpdate = Updateable<typeof Post>;

    // Type-level assertions
    expectTypeOf<PostSelect>().toHaveProperty('title');
    expectTypeOf<PostInsert>().toHaveProperty('title');
  });
});

/**
 * Helper to extract property names from a TypeLiteral AST
 */
const getPropertyNames = (schema: Schema.Schema<unknown, unknown>): string[] => {
  const ast = schema.ast;
  if (!AST.isTypeLiteral(ast)) return [];
  return ast.propertySignatures.map((prop) => String(prop.name));
};

describe('Type-level tests for columnType exclusion', () => {
  it('should exclude Never-typed fields from Insertable at compile time', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      name: Schema.String,
      email: Schema.String,
    });

    const User = getSchemas(_User);

    // Runtime assertion: verify id is excluded from Insertable schema
    const insertableFields = getPropertyNames(User.Insertable);
    expect(insertableFields).toContain('name');
    expect(insertableFields).toContain('email');
    expect(insertableFields).not.toContain('id');

    // Type-level assertion: verify types are correct at compile time
    type UserInsert = Insertable<typeof User>;
    expectTypeOf<UserInsert>().toHaveProperty('name');
    expectTypeOf<UserInsert>().toHaveProperty('email');
    expectTypeOf<UserInsert>().not.toHaveProperty('id');
  });

  it('should exclude Never-typed fields from Updateable at compile time', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      name: Schema.String,
      email: Schema.String,
    });

    const User = getSchemas(_User);

    // Runtime assertion: verify id is excluded from Updateable schema
    const updateableFields = getPropertyNames(User.Updateable);
    expect(updateableFields).toContain('name');
    expect(updateableFields).toContain('email');
    expect(updateableFields).not.toContain('id');

    // Type-level assertion: verify types are correct at compile time
    type UserUpdate = Updateable<typeof User>;
    expectTypeOf<UserUpdate>().not.toHaveProperty('id');
    expectTypeOf<UserUpdate>().toMatchTypeOf<{ name?: string; email?: string }>();
  });

  it('should include all fields in Selectable', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      name: Schema.String,
      email: Schema.String,
    });

    const User = getSchemas(_User);

    // Runtime assertion: verify all fields are in Selectable schema
    const selectableFields = getPropertyNames(User.Selectable);
    expect(selectableFields).toContain('id');
    expect(selectableFields).toContain('name');
    expect(selectableFields).toContain('email');

    // Type-level assertion: verify types are correct at compile time
    type UserSelect = Selectable<typeof User>;
    expectTypeOf<UserSelect>().toHaveProperty('id');
    expectTypeOf<UserSelect>().toHaveProperty('name');
    expectTypeOf<UserSelect>().toHaveProperty('email');
  });
});

describe('getSchemas with Id parameter', () => {
  it('should preserve _base when using getSchemas with Id', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      name: Schema.String,
    });
    const UserIdSchema = Schema.UUID.pipe(Schema.brand('UserId'));

    const User = getSchemas(_User, UserIdSchema);

    // Runtime: _base and Id should exist
    expect(User).toHaveProperty('_base');
    expect(User).toHaveProperty('Id');
    expect(User).toHaveProperty('Selectable');
    expect(User).toHaveProperty('Insertable');
    expect(User).toHaveProperty('Updateable');

    // Verify _base is the original schema
    expect(User._base).toBe(_User);
  });

  it('should correctly exclude Never-typed fields with Id parameter', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      name: Schema.String,
      email: Schema.String,
    });
    const UserIdSchema = Schema.UUID.pipe(Schema.brand('UserId'));

    const User = getSchemas(_User, UserIdSchema);

    // Runtime assertion: verify id is excluded from Insertable schema
    const insertableFields = getPropertyNames(User.Insertable);
    expect(insertableFields).toContain('name');
    expect(insertableFields).toContain('email');
    expect(insertableFields).not.toContain('id');

    // Type-level assertion: verify Insertable excludes id
    type UserInsert = Insertable<typeof User>;
    expectTypeOf<UserInsert>().toHaveProperty('name');
    expectTypeOf<UserInsert>().toHaveProperty('email');
    expectTypeOf<UserInsert>().not.toHaveProperty('id');

    // Type-level assertion: verify Id type is correct
    type UserId = Id<typeof User>;
    expectTypeOf<UserId>().toBeString();
  });

  it('should work without Id parameter (backward compatibility)', () => {
    const _Post = Schema.Struct({
      title: Schema.String,
      content: Schema.String,
    });

    const Post = getSchemas(_Post);

    // Runtime: _base should exist, Id should NOT exist
    expect(Post).toHaveProperty('_base');
    expect(Post).not.toHaveProperty('Id');

    // Type-level assertion
    type PostInsert = Insertable<typeof Post>;
    expectTypeOf<PostInsert>().toHaveProperty('title');
    expectTypeOf<PostInsert>().toHaveProperty('content');
  });
});

describe('Type-level tests for generated() exclusion', () => {
  it('should exclude generated() fields from Insertable at compile time', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      createdAt: generated(Schema.DateFromSelf),
      name: Schema.String,
    });

    const User = getSchemas(_User);

    // Runtime assertion (already works)
    const insertableFields = getPropertyNames(User.Insertable);
    expect(insertableFields).toContain('name');
    expect(insertableFields).not.toContain('id');
    expect(insertableFields).not.toContain('createdAt');

    // Type-level assertion using explicit key check
    type UserInsert = Insertable<typeof User>;

    // These should be in UserInsert
    type HasName = 'name' extends keyof UserInsert ? true : false;
    expectTypeOf<HasName>().toEqualTypeOf<true>();

    // These should NOT be in UserInsert (generated/columnType with Never)
    type HasId = 'id' extends keyof UserInsert ? true : false;
    type HasCreatedAt = 'createdAt' extends keyof UserInsert ? true : false;
    expectTypeOf<HasId>().toEqualTypeOf<false>();
    expectTypeOf<HasCreatedAt>().toEqualTypeOf<false>(); // This will fail until fix is applied
  });

  it('should include generated() fields in Updateable at compile time', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      createdAt: generated(Schema.DateFromSelf),
      name: Schema.String,
    });

    const User = getSchemas(_User);

    // generated() fields SHOULD be in Updateable (unlike columnType with Never)
    type UserUpdate = Updateable<typeof User>;
    type UpdateHasId = 'id' extends keyof UserUpdate ? true : false;
    type UpdateHasCreatedAt = 'createdAt' extends keyof UserUpdate ? true : false;
    type UpdateHasName = 'name' extends keyof UserUpdate ? true : false;

    expectTypeOf<UpdateHasId>().toEqualTypeOf<false>(); // columnType excludes
    expectTypeOf<UpdateHasCreatedAt>().toEqualTypeOf<true>(); // generated() includes in update
    expectTypeOf<UpdateHasName>().toEqualTypeOf<true>();
  });

  it('should include generated() fields in Selectable at compile time', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      createdAt: generated(Schema.DateFromSelf),
      name: Schema.String,
    });

    const User = getSchemas(_User);

    type UserSelect = Selectable<typeof User>;
    type SelectHasId = 'id' extends keyof UserSelect ? true : false;
    type SelectHasCreatedAt = 'createdAt' extends keyof UserSelect ? true : false;
    type SelectHasName = 'name' extends keyof UserSelect ? true : false;

    expectTypeOf<SelectHasId>().toEqualTypeOf<true>();
    expectTypeOf<SelectHasCreatedAt>().toEqualTypeOf<true>();
    expectTypeOf<SelectHasName>().toEqualTypeOf<true>();
  });

  it('should handle multiple generated() fields', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      createdAt: generated(Schema.DateFromSelf),
      updatedAt: generated(Schema.DateFromSelf),
      sessionId: generated(Schema.UUID),
      name: Schema.String,
      email: Schema.String,
    });

    const User = getSchemas(_User);

    type UserInsert = Insertable<typeof User>;
    type HasName = 'name' extends keyof UserInsert ? true : false;
    type HasEmail = 'email' extends keyof UserInsert ? true : false;
    type HasId = 'id' extends keyof UserInsert ? true : false;
    type HasCreatedAt = 'createdAt' extends keyof UserInsert ? true : false;
    type HasUpdatedAt = 'updatedAt' extends keyof UserInsert ? true : false;
    type HasSessionId = 'sessionId' extends keyof UserInsert ? true : false;

    expectTypeOf<HasName>().toEqualTypeOf<true>();
    expectTypeOf<HasEmail>().toEqualTypeOf<true>();
    expectTypeOf<HasId>().toEqualTypeOf<false>();
    expectTypeOf<HasCreatedAt>().toEqualTypeOf<false>();
    expectTypeOf<HasUpdatedAt>().toEqualTypeOf<false>();
    expectTypeOf<HasSessionId>().toEqualTypeOf<false>();
  });
});
