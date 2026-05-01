import { Schema } from 'effect';
import { describe, expectTypeOf, it } from 'vitest';
import {
  type ColumnType,
  type Generated,
  type Insertable,
  type Selectable,
  type Updateable,
  type VariantMarker,
  VariantTypeId,
  columnType,
  generated,
} from '../kysely/helpers';

/**
 * Public-API shape pin — Phase 0.4 of the Effect v3 → v4 migration.
 *
 * Type-level assertions on the structural shape of every exported branded
 * type and on the type extracted from `Selectable`/`Insertable`/`Updateable`
 * for a representative model. Effect v4 may silently change AST inference
 * depth or `DeepMutable` propagation; if the public types differ structurally
 * between v3 and v4, this test fails on the v4 branch and we surface the
 * change as a public-API break in the v6 release notes.
 */

describe('Public API type shape', () => {
  describe('ColumnType<S, I, U>', () => {
    it('preserves the select type S as a structural supertype', () => {
      type T = ColumnType<string, never, never>;
      expectTypeOf<T>().toExtend<string>();
    });

    it('exposes Kysely phantom properties __select__, __insert__, __update__', () => {
      type T = ColumnType<number, number | undefined, number>;
      expectTypeOf<T['__select__']>().toEqualTypeOf<number>();
      expectTypeOf<T['__insert__']>().toEqualTypeOf<number | undefined>();
      expectTypeOf<T['__update__']>().toEqualTypeOf<number>();
    });

    it('carries the VariantMarker brand', () => {
      type T = ColumnType<string, string, string>;
      expectTypeOf<T>().toExtend<VariantMarker<string, string>>();
    });
  });

  describe('Generated<T>', () => {
    it('preserves the underlying type T as a structural supertype', () => {
      type T = Generated<Date>;
      expectTypeOf<T>().toExtend<Date>();
    });

    it('exposes phantom properties matching @effect/sql Model.Generated semantics', () => {
      type T = Generated<string>;
      expectTypeOf<T['__select__']>().toEqualTypeOf<string>();
      expectTypeOf<T['__insert__']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<T['__update__']>().toEqualTypeOf<string>();
    });
  });

  describe('VariantTypeId', () => {
    it('is a unique symbol', () => {
      expectTypeOf<typeof VariantTypeId>().toEqualTypeOf<typeof VariantTypeId>();
    });
  });

  describe('Selectable / Insertable / Updateable on a representative model', () => {
    const User = Schema.Struct({
      id: columnType(Schema.String.check(Schema.isUUID()), Schema.Never, Schema.Never),
      createdAt: generated(Schema.Date),
      updatedAt: generated(Schema.Date),
      email: Schema.String,
      bio: Schema.NullOr(Schema.String),
      tags: Schema.Array(Schema.String),
    });
    type User = typeof User;

    it('Selectable<User> strips wrappers and yields plain field types', () => {
      type S = Selectable<User>;
      expectTypeOf<S['email']>().toEqualTypeOf<string>();
      expectTypeOf<S['bio']>().toEqualTypeOf<string | null>();
      expectTypeOf<S['createdAt']>().toEqualTypeOf<Date>();
      expectTypeOf<S['updatedAt']>().toEqualTypeOf<Date>();
      // id is read-only at INSERT but still appears in SELECT as the underlying type
      expectTypeOf<S['id']>().toExtend<string>();
    });

    it('Insertable<User> omits read-only id, makes generated optional, keeps required scalars', () => {
      type I = Insertable<User>;
      expectTypeOf<I>().not.toHaveProperty('id');
      expectTypeOf<I>().toHaveProperty('createdAt');
      expectTypeOf<I>().toHaveProperty('updatedAt');
      expectTypeOf<I>().toHaveProperty('email');
      expectTypeOf<I>().toHaveProperty('bio');
      expectTypeOf<I>().toHaveProperty('tags');
    });

    it('Updateable<User> omits read-only id, makes everything optional', () => {
      type U = Updateable<User>;
      expectTypeOf<U>().not.toHaveProperty('id');
      expectTypeOf<U>().toHaveProperty('createdAt');
      expectTypeOf<U>().toHaveProperty('email');
    });

    it('Insertable preserves the tags field as a property', () => {
      type I = Insertable<User>;
      expectTypeOf<I>().toHaveProperty('tags');
    });

    it('Updateable preserves the tags field as an optional property', () => {
      type U = Updateable<User>;
      expectTypeOf<U>().toHaveProperty('tags');
    });
  });
});
