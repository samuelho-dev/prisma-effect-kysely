/* eslint-disable vitest/expect-expect */
// Type-level tests use expectTypeOf which doesn't count as runtime assertions
import { Schema } from 'effect';
import { describe, it, expectTypeOf } from 'vitest';
import { columnType, getSchemas, Insertable, Updateable, Selectable } from '../kysely/helpers.js';

describe('Type-level tests for columnType exclusion', () => {
  it('should exclude Never-typed fields from Insertable at compile time', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      name: Schema.String,
      email: Schema.String,
    });

    const User = getSchemas(_User);

    type UserInsert = Insertable<typeof User>;

    // id should NOT be a key in UserInsert
    expectTypeOf<UserInsert>().toHaveProperty('name');
    expectTypeOf<UserInsert>().toHaveProperty('email');
    // This should fail type checking if id is in UserInsert
    expectTypeOf<UserInsert>().not.toHaveProperty('id');
  });

  it('should exclude Never-typed fields from Updateable at compile time', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      name: Schema.String,
      email: Schema.String,
    });

    const User = getSchemas(_User);

    type UserUpdate = Updateable<typeof User>;

    // id should NOT be a key in UserUpdate
    expectTypeOf<UserUpdate>().not.toHaveProperty('id');
    // name and email should be optional
    expectTypeOf<UserUpdate>().toMatchTypeOf<{ name?: string; email?: string }>();
  });

  it('should include all fields in Selectable', () => {
    const _User = Schema.Struct({
      id: columnType(Schema.UUID, Schema.Never, Schema.Never),
      name: Schema.String,
      email: Schema.String,
    });

    const User = getSchemas(_User);

    type UserSelect = Selectable<typeof User>;

    // All fields should be in Selectable
    expectTypeOf<UserSelect>().toHaveProperty('id');
    expectTypeOf<UserSelect>().toHaveProperty('name');
    expectTypeOf<UserSelect>().toHaveProperty('email');
  });
});
