/**
 * Generated: 2025-10-12T09:16:58.952Z
 * DO NOT EDIT MANUALLY
 */

import { Schema } from 'effect';
import { columnType, generated, getSchemas } from 'prisma-effect-kysely';
import { Role, Status, RoleSchema, StatusSchema } from './enums';

// AllTypes Base Schema
export const _AllTypes = Schema.Struct({
  bigIntArray: Schema.Array(Schema.BigInt),
  bigIntField: Schema.BigInt,
  boolArray: Schema.Array(Schema.Boolean),
  boolField: Schema.Boolean,
  bytesArray: Schema.Array(Schema.Uint8Array),
  bytesField: Schema.Uint8Array,
  createdAt: generated(Schema.Date),
  cuidField: generated(Schema.String),
  dateArray: Schema.Array(Schema.Date),
  dateField: Schema.Date,
  decimalArray: Schema.Array(Schema.String),
  decimalField: Schema.String,
  floatArray: Schema.Array(Schema.Number),
  floatField: Schema.Number,
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  intArray: Schema.Array(Schema.Number),
  intField: Schema.Number,
  jsonArray: Schema.Array(Schema.Unknown),
  jsonField: Schema.Unknown,
  mappedField: Schema.propertySignature(Schema.String).pipe(Schema.fromKey('db_mapped_field')),
  mappedWithDefault: Schema.propertySignature(generated(Schema.Number)).pipe(
    Schema.fromKey('mapped_default')
  ),
  optionalBigInt: Schema.UndefinedOr(Schema.BigInt),
  optionalBool: Schema.UndefinedOr(Schema.Boolean),
  optionalBytes: Schema.UndefinedOr(Schema.Uint8Array),
  optionalDate: Schema.UndefinedOr(Schema.Date),
  optionalDecimal: Schema.UndefinedOr(Schema.String),
  optionalFloat: Schema.UndefinedOr(Schema.Number),
  optionalInt: Schema.UndefinedOr(Schema.Number),
  optionalJson: Schema.UndefinedOr(Schema.Unknown),
  optionalRole: Schema.UndefinedOr(RoleSchema),
  optionalStatus: Schema.UndefinedOr(StatusSchema),
  optionalString: Schema.UndefinedOr(Schema.String),
  role: RoleSchema,
  roleArray: Schema.Array(RoleSchema),
  session_id: generated(Schema.UUID),
  status: StatusSchema,
  statusArray: Schema.Array(StatusSchema),
  stringArray: Schema.Array(Schema.String),
  stringField: Schema.String,
  tenant_id: Schema.UUID,
  ulidField: generated(Schema.String),
  uniqueEmail: Schema.String,
  updatedAt: Schema.Date,
});

export namespace AllTypes {
  const schemas = getSchemas(_AllTypes);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}

export namespace AllTypes {
  export type Select = Schema.Schema.Type<typeof AllTypes.Selectable>;
  export type Insert = Schema.Schema.Type<typeof AllTypes.Insertable>;
  export type Update = Schema.Schema.Type<typeof AllTypes.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof AllTypes.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof AllTypes.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof AllTypes.Updateable>;
}

// AnnotationTest Base Schema
export const _AnnotationTest = Schema.Struct({
  age: Schema.Number.pipe(Schema.positive()),
  coordinates: Schema.Array(Schema.Array(Schema.Number).pipe(Schema.itemsCount(3))),
  createdAt: generated(Schema.Date),
  email: Schema.String.pipe(Schema.email()),
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  userId: Schema.String.pipe(Schema.brand('UserId')),
});

export namespace AnnotationTest {
  const schemas = getSchemas(_AnnotationTest);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}

export namespace AnnotationTest {
  export type Select = Schema.Schema.Type<typeof AnnotationTest.Selectable>;
  export type Insert = Schema.Schema.Type<typeof AnnotationTest.Insertable>;
  export type Update = Schema.Schema.Type<typeof AnnotationTest.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof AnnotationTest.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof AnnotationTest.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof AnnotationTest.Updateable>;
}

// Category Base Schema
export const _Category = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
});

export namespace Category {
  const schemas = getSchemas(_Category);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}

export namespace Category {
  export type Select = Schema.Schema.Type<typeof Category.Selectable>;
  export type Insert = Schema.Schema.Type<typeof Category.Insertable>;
  export type Update = Schema.Schema.Type<typeof Category.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof Category.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof Category.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof Category.Updateable>;
}

// CompositeIdModel Base Schema
export const _CompositeIdModel = Schema.Struct({
  postId: Schema.UUID,
  timestamp: generated(Schema.Date),
  userId: Schema.UUID,
});

export namespace CompositeIdModel {
  const schemas = getSchemas(_CompositeIdModel);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}

export namespace CompositeIdModel {
  export type Select = Schema.Schema.Type<typeof CompositeIdModel.Selectable>;
  export type Insert = Schema.Schema.Type<typeof CompositeIdModel.Insertable>;
  export type Update = Schema.Schema.Type<typeof CompositeIdModel.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof CompositeIdModel.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof CompositeIdModel.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof CompositeIdModel.Updateable>;
}

// Employee Base Schema
export const _Employee = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  managerId: Schema.UndefinedOr(Schema.UUID),
  name: Schema.String,
});

export namespace Employee {
  const schemas = getSchemas(_Employee);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}

export namespace Employee {
  export type Select = Schema.Schema.Type<typeof Employee.Selectable>;
  export type Insert = Schema.Schema.Type<typeof Employee.Insertable>;
  export type Update = Schema.Schema.Type<typeof Employee.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof Employee.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof Employee.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof Employee.Updateable>;
}

// Post Base Schema
export const _Post = Schema.Struct({
  authorId: Schema.UUID,
  content: Schema.UndefinedOr(Schema.String),
  createdAt: generated(Schema.Date),
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  published: generated(Schema.Boolean),
  title: Schema.String,
  updatedAt: Schema.Date,
});

export namespace Post {
  const schemas = getSchemas(_Post);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}

export namespace Post {
  export type Select = Schema.Schema.Type<typeof Post.Selectable>;
  export type Insert = Schema.Schema.Type<typeof Post.Insertable>;
  export type Update = Schema.Schema.Type<typeof Post.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof Post.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof Post.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof Post.Updateable>;
}

// Profile Base Schema
export const _Profile = Schema.Struct({
  bio: Schema.String,
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  userId: Schema.UUID,
});

export namespace Profile {
  const schemas = getSchemas(_Profile);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}

export namespace Profile {
  export type Select = Schema.Schema.Type<typeof Profile.Selectable>;
  export type Insert = Schema.Schema.Type<typeof Profile.Insertable>;
  export type Update = Schema.Schema.Type<typeof Profile.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof Profile.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof Profile.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof Profile.Updateable>;
}

// session_model_preference Base Schema
export const _session_model_preference = Schema.Struct({
  createdAt: generated(Schema.Date),
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  language: generated(Schema.String),
  notifications: generated(Schema.Boolean),
  theme: Schema.String,
  updatedAt: Schema.Date,
  user_id: Schema.UUID,
});

export namespace session_model_preference {
  const schemas = getSchemas(_session_model_preference);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}

export namespace session_model_preference {
  export type Select = Schema.Schema.Type<typeof session_model_preference.Selectable>;
  export type Insert = Schema.Schema.Type<typeof session_model_preference.Insertable>;
  export type Update = Schema.Schema.Type<typeof session_model_preference.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof session_model_preference.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof session_model_preference.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof session_model_preference.Updateable>;
}

// User Base Schema
export const _User = Schema.Struct({
  createdAt: generated(Schema.Date),
  email: Schema.String,
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
  updatedAt: Schema.Date,
});

export namespace User {
  const schemas = getSchemas(_User);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}

export namespace User {
  export type Select = Schema.Schema.Type<typeof User.Selectable>;
  export type Insert = Schema.Schema.Type<typeof User.Insertable>;
  export type Update = Schema.Schema.Type<typeof User.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof User.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof User.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof User.Updateable>;
}

// _CategoryToPost Join Table Schema
export const _CategoryToPost = Schema.Struct({
  A: columnType(Schema.UUID, Schema.Never, Schema.Never),
  B: columnType(Schema.UUID, Schema.Never, Schema.Never),
});

export namespace CategoryToPost {
  const schemas = getSchemas(_CategoryToPost);
  export const Selectable = schemas.Selectable;
  export const Insertable = schemas.Insertable;
  export const Updateable = schemas.Updateable;
}

export namespace CategoryToPost {
  export type Select = Schema.Schema.Type<typeof CategoryToPost.Selectable>;
  export type Insert = Schema.Schema.Type<typeof CategoryToPost.Insertable>;
  export type Update = Schema.Schema.Type<typeof CategoryToPost.Updateable>;
  export type SelectEncoded = Schema.Schema.Encoded<typeof CategoryToPost.Selectable>;
  export type InsertEncoded = Schema.Schema.Encoded<typeof CategoryToPost.Insertable>;
  export type UpdateEncoded = Schema.Schema.Encoded<typeof CategoryToPost.Updateable>;
}

// Kysely Database Interface
export interface DB {
  AllTypes: Schema.Schema.Encoded<typeof _AllTypes>;
  AnnotationTest: Schema.Schema.Encoded<typeof _AnnotationTest>;
  Category: Schema.Schema.Encoded<typeof _Category>;
  composite_id_table: Schema.Schema.Encoded<typeof _CompositeIdModel>;
  Employee: Schema.Schema.Encoded<typeof _Employee>;
  Post: Schema.Schema.Encoded<typeof _Post>;
  Profile: Schema.Schema.Encoded<typeof _Profile>;
  session_preferences: Schema.Schema.Encoded<typeof _session_model_preference>;
  User: Schema.Schema.Encoded<typeof _User>;
  _CategoryToPost: Schema.Schema.Encoded<typeof _CategoryToPost>;
}
