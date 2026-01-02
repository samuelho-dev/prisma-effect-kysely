import { Schema } from 'effect';
import * as AST from 'effect/SchemaAST';
import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  columnType,
  getSchemas,
  Insertable,
  Updateable,
  Selectable,
  Id,
} from '../kysely/helpers.js';

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
