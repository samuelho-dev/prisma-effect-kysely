/**
 * Generated: 2025-10-13T06:54:49.095Z
 * DO NOT EDIT MANUALLY
 */

import { Schema } from 'effect';
import { columnType, generated, getSchemas } from 'prisma-effect-kysely';
import { RoleSchema, StatusSchema } from './enums';

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

export const AllTypes = getSchemas(_AllTypes);

export type AllTypesSelect = Schema.Schema.Type<typeof AllTypes.Selectable>;
export type AllTypesInsert = Schema.Schema.Type<typeof AllTypes.Insertable>;
export type AllTypesUpdate = Schema.Schema.Type<typeof AllTypes.Updateable>;
export type AllTypesSelectEncoded = Schema.Schema.Encoded<typeof AllTypes.Selectable>;
export type AllTypesInsertEncoded = Schema.Schema.Encoded<typeof AllTypes.Insertable>;
export type AllTypesUpdateEncoded = Schema.Schema.Encoded<typeof AllTypes.Updateable>;

// AnnotationTest Base Schema
export const _AnnotationTest = Schema.Struct({
  age: Schema.Number.pipe(Schema.positive()),
  coordinates: Schema.Array(Schema.Array(Schema.Number).pipe(Schema.itemsCount(3))),
  createdAt: generated(Schema.Date),
  email: Schema.String.pipe(Schema.email()),
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  userId: Schema.String.pipe(Schema.brand('UserId')),
});

export const AnnotationTest = getSchemas(_AnnotationTest);

export type AnnotationTestSelect = Schema.Schema.Type<typeof AnnotationTest.Selectable>;
export type AnnotationTestInsert = Schema.Schema.Type<typeof AnnotationTest.Insertable>;
export type AnnotationTestUpdate = Schema.Schema.Type<typeof AnnotationTest.Updateable>;
export type AnnotationTestSelectEncoded = Schema.Schema.Encoded<typeof AnnotationTest.Selectable>;
export type AnnotationTestInsertEncoded = Schema.Schema.Encoded<typeof AnnotationTest.Insertable>;
export type AnnotationTestUpdateEncoded = Schema.Schema.Encoded<typeof AnnotationTest.Updateable>;

// Category Base Schema
export const _Category = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
});

export const Category = getSchemas(_Category);

export type CategorySelect = Schema.Schema.Type<typeof Category.Selectable>;
export type CategoryInsert = Schema.Schema.Type<typeof Category.Insertable>;
export type CategoryUpdate = Schema.Schema.Type<typeof Category.Updateable>;
export type CategorySelectEncoded = Schema.Schema.Encoded<typeof Category.Selectable>;
export type CategoryInsertEncoded = Schema.Schema.Encoded<typeof Category.Insertable>;
export type CategoryUpdateEncoded = Schema.Schema.Encoded<typeof Category.Updateable>;

// CompositeIdModel Base Schema
export const _CompositeIdModel = Schema.Struct({
  postId: Schema.UUID,
  timestamp: generated(Schema.Date),
  userId: Schema.UUID,
});

export const CompositeIdModel = getSchemas(_CompositeIdModel);

export type CompositeIdModelSelect = Schema.Schema.Type<typeof CompositeIdModel.Selectable>;
export type CompositeIdModelInsert = Schema.Schema.Type<typeof CompositeIdModel.Insertable>;
export type CompositeIdModelUpdate = Schema.Schema.Type<typeof CompositeIdModel.Updateable>;
export type CompositeIdModelSelectEncoded = Schema.Schema.Encoded<
  typeof CompositeIdModel.Selectable
>;
export type CompositeIdModelInsertEncoded = Schema.Schema.Encoded<
  typeof CompositeIdModel.Insertable
>;
export type CompositeIdModelUpdateEncoded = Schema.Schema.Encoded<
  typeof CompositeIdModel.Updateable
>;

// Employee Base Schema
export const _Employee = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  managerId: Schema.UndefinedOr(Schema.UUID),
  name: Schema.String,
});

export const Employee = getSchemas(_Employee);

export type EmployeeSelect = Schema.Schema.Type<typeof Employee.Selectable>;
export type EmployeeInsert = Schema.Schema.Type<typeof Employee.Insertable>;
export type EmployeeUpdate = Schema.Schema.Type<typeof Employee.Updateable>;
export type EmployeeSelectEncoded = Schema.Schema.Encoded<typeof Employee.Selectable>;
export type EmployeeInsertEncoded = Schema.Schema.Encoded<typeof Employee.Insertable>;
export type EmployeeUpdateEncoded = Schema.Schema.Encoded<typeof Employee.Updateable>;

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

export const Post = getSchemas(_Post);

export type PostSelect = Schema.Schema.Type<typeof Post.Selectable>;
export type PostInsert = Schema.Schema.Type<typeof Post.Insertable>;
export type PostUpdate = Schema.Schema.Type<typeof Post.Updateable>;
export type PostSelectEncoded = Schema.Schema.Encoded<typeof Post.Selectable>;
export type PostInsertEncoded = Schema.Schema.Encoded<typeof Post.Insertable>;
export type PostUpdateEncoded = Schema.Schema.Encoded<typeof Post.Updateable>;

// Product Base Schema
export const _Product = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
});

export const Product = getSchemas(_Product);

export type ProductSelect = Schema.Schema.Type<typeof Product.Selectable>;
export type ProductInsert = Schema.Schema.Type<typeof Product.Insertable>;
export type ProductUpdate = Schema.Schema.Type<typeof Product.Updateable>;
export type ProductSelectEncoded = Schema.Schema.Encoded<typeof Product.Selectable>;
export type ProductInsertEncoded = Schema.Schema.Encoded<typeof Product.Insertable>;
export type ProductUpdateEncoded = Schema.Schema.Encoded<typeof Product.Updateable>;

// ProductTag Base Schema
export const _ProductTag = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
});

export const ProductTag = getSchemas(_ProductTag);

export type ProductTagSelect = Schema.Schema.Type<typeof ProductTag.Selectable>;
export type ProductTagInsert = Schema.Schema.Type<typeof ProductTag.Insertable>;
export type ProductTagUpdate = Schema.Schema.Type<typeof ProductTag.Updateable>;
export type ProductTagSelectEncoded = Schema.Schema.Encoded<typeof ProductTag.Selectable>;
export type ProductTagInsertEncoded = Schema.Schema.Encoded<typeof ProductTag.Insertable>;
export type ProductTagUpdateEncoded = Schema.Schema.Encoded<typeof ProductTag.Updateable>;

// Profile Base Schema
export const _Profile = Schema.Struct({
  bio: Schema.String,
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  userId: Schema.UUID,
});

export const Profile = getSchemas(_Profile);

export type ProfileSelect = Schema.Schema.Type<typeof Profile.Selectable>;
export type ProfileInsert = Schema.Schema.Type<typeof Profile.Insertable>;
export type ProfileUpdate = Schema.Schema.Type<typeof Profile.Updateable>;
export type ProfileSelectEncoded = Schema.Schema.Encoded<typeof Profile.Selectable>;
export type ProfileInsertEncoded = Schema.Schema.Encoded<typeof Profile.Insertable>;
export type ProfileUpdateEncoded = Schema.Schema.Encoded<typeof Profile.Updateable>;

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

export const SessionModelPreference = getSchemas(_session_model_preference);

export type SessionModelPreferenceSelect = Schema.Schema.Type<
  typeof SessionModelPreference.Selectable
>;
export type SessionModelPreferenceInsert = Schema.Schema.Type<
  typeof SessionModelPreference.Insertable
>;
export type SessionModelPreferenceUpdate = Schema.Schema.Type<
  typeof SessionModelPreference.Updateable
>;
export type SessionModelPreferenceSelectEncoded = Schema.Schema.Encoded<
  typeof SessionModelPreference.Selectable
>;
export type SessionModelPreferenceInsertEncoded = Schema.Schema.Encoded<
  typeof SessionModelPreference.Insertable
>;
export type SessionModelPreferenceUpdateEncoded = Schema.Schema.Encoded<
  typeof SessionModelPreference.Updateable
>;

// User Base Schema
export const _User = Schema.Struct({
  createdAt: generated(Schema.Date),
  email: Schema.String,
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
  updatedAt: Schema.Date,
});

export const User = getSchemas(_User);

export type UserSelect = Schema.Schema.Type<typeof User.Selectable>;
export type UserInsert = Schema.Schema.Type<typeof User.Insertable>;
export type UserUpdate = Schema.Schema.Type<typeof User.Updateable>;
export type UserSelectEncoded = Schema.Schema.Encoded<typeof User.Selectable>;
export type UserInsertEncoded = Schema.Schema.Encoded<typeof User.Insertable>;
export type UserUpdateEncoded = Schema.Schema.Encoded<typeof User.Updateable>;

// _CategoryToPost Join Table Schema
export const _CategoryToPost = Schema.Struct({
  A: columnType(Schema.UUID, Schema.Never, Schema.Never),
  B: columnType(Schema.UUID, Schema.Never, Schema.Never),
});

export const CategoryToPost = getSchemas(_CategoryToPost);

export type CategoryToPostSelect = Schema.Schema.Type<typeof CategoryToPost.Selectable>;
export type CategoryToPostInsert = Schema.Schema.Type<typeof CategoryToPost.Insertable>;
export type CategoryToPostUpdate = Schema.Schema.Type<typeof CategoryToPost.Updateable>;
export type CategoryToPostSelectEncoded = Schema.Schema.Encoded<typeof CategoryToPost.Selectable>;
export type CategoryToPostInsertEncoded = Schema.Schema.Encoded<typeof CategoryToPost.Insertable>;
export type CategoryToPostUpdateEncoded = Schema.Schema.Encoded<typeof CategoryToPost.Updateable>;

// _product_tags Join Table Schema
export const _product_tags = Schema.Struct({
  A: columnType(Schema.UUID, Schema.Never, Schema.Never),
  B: columnType(Schema.UUID, Schema.Never, Schema.Never),
});

export const product_tags = getSchemas(_product_tags);

export type product_tagsSelect = Schema.Schema.Type<typeof product_tags.Selectable>;
export type product_tagsInsert = Schema.Schema.Type<typeof product_tags.Insertable>;
export type product_tagsUpdate = Schema.Schema.Type<typeof product_tags.Updateable>;
export type product_tagsSelectEncoded = Schema.Schema.Encoded<typeof product_tags.Selectable>;
export type product_tagsInsertEncoded = Schema.Schema.Encoded<typeof product_tags.Insertable>;
export type product_tagsUpdateEncoded = Schema.Schema.Encoded<typeof product_tags.Updateable>;

// Kysely Database Interface
export interface DB {
  AllTypes: AllTypesSelectEncoded;
  AnnotationTest: AnnotationTestSelectEncoded;
  Category: CategorySelectEncoded;
  composite_id_table: CompositeIdModelSelectEncoded;
  Employee: EmployeeSelectEncoded;
  Post: PostSelectEncoded;
  Product: ProductSelectEncoded;
  ProductTag: ProductTagSelectEncoded;
  Profile: ProfileSelectEncoded;
  session_preferences: SessionModelPreferenceSelectEncoded;
  User: UserSelectEncoded;
  _CategoryToPost: CategoryToPostSelectEncoded;
  _product_tags: product_tagsSelectEncoded;
}
