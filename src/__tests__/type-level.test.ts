import { Schema } from 'effect';
import * as AST from 'effect/SchemaAST';
import { describe, it, expect, expectTypeOf } from 'vitest';
import { columnType, getSchemas, Insertable, Updateable, Selectable } from '../kysely/helpers.js';

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
