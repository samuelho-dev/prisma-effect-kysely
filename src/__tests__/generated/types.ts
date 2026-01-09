/**
 * Generated: 2026-01-09T22:45:16.374Z
 * DO NOT EDIT MANUALLY
 */

import { Schema } from 'effect';
import type { ColumnType } from 'kysely';
import { columnType, generated, getSchemas } from 'prisma-effect-kysely';
import { RoleSchema, StatusSchema } from './enums.js';

// Kysely table interface for AllTypes (internal)
interface AllTypesTable {
  bigIntArray: Array<string>;
  bigIntField: string;
  boolArray: Array<boolean>;
  boolField: boolean;
  bytesArray: Array<Buffer>;
  bytesField: Buffer;
  createdAt: ColumnType<Date, Date | undefined, Date | undefined>;
  cuidField: ColumnType<string, string | undefined, string | undefined>;
  dateArray: Array<Date>;
  dateField: Date;
  decimalArray: Array<string>;
  decimalField: string;
  floatArray: Array<number>;
  floatField: number;
  id: ColumnType<string, never, never>;
  intArray: Array<number>;
  intField: number;
  jsonArray: Array<unknown>;
  jsonField: unknown;
  mappedField: string;
  mappedWithDefault: ColumnType<number, number | undefined, number | undefined>;
  optionalBigInt: string | null;
  optionalBool: boolean | null;
  optionalBytes: Buffer | null;
  optionalDate: Date | null;
  optionalDecimal: string | null;
  optionalFloat: number | null;
  optionalInt: number | null;
  optionalJson: unknown | null;
  optionalRole: Schema.Schema.Type<typeof RoleSchema> | null;
  optionalStatus: Schema.Schema.Type<typeof StatusSchema> | null;
  optionalString: string | null;
  role: Schema.Schema.Type<typeof RoleSchema>;
  roleArray: Array<Schema.Schema.Type<typeof RoleSchema>>;
  session_id: ColumnType<string, string | undefined, string | undefined>;
  status: Schema.Schema.Type<typeof StatusSchema>;
  statusArray: Array<Schema.Schema.Type<typeof StatusSchema>>;
  stringArray: Array<string>;
  stringField: string;
  tenant_id: string;
  ulidField: ColumnType<string, string | undefined, string | undefined>;
  uniqueEmail: string;
  updatedAt: ColumnType<Date, Date | undefined, Date | undefined>;
}

// AllTypes Base Schema (internal)
const _AllTypes = Schema.Struct({
  bigIntArray: Schema.Array(Schema.BigInt),
  bigIntField: Schema.BigInt,
  boolArray: Schema.Array(Schema.Boolean),
  boolField: Schema.Boolean,
  bytesArray: Schema.Array(Schema.Uint8Array),
  bytesField: Schema.Uint8Array,
  createdAt: generated(Schema.DateFromSelf),
  cuidField: generated(Schema.String),
  dateArray: Schema.Array(Schema.DateFromSelf),
  dateField: Schema.DateFromSelf,
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
  optionalBigInt: Schema.NullOr(Schema.BigInt),
  optionalBool: Schema.NullOr(Schema.Boolean),
  optionalBytes: Schema.NullOr(Schema.Uint8Array),
  optionalDate: Schema.NullOr(Schema.DateFromSelf),
  optionalDecimal: Schema.NullOr(Schema.String),
  optionalFloat: Schema.NullOr(Schema.Number),
  optionalInt: Schema.NullOr(Schema.Number),
  optionalJson: Schema.NullOr(Schema.Unknown),
  optionalRole: Schema.NullOr(RoleSchema),
  optionalStatus: Schema.NullOr(StatusSchema),
  optionalString: Schema.NullOr(Schema.String),
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
  updatedAt: Schema.DateFromSelf,
});

const AllTypesIdSchema = Schema.UUID.pipe(Schema.brand('AllTypesId'));
export type AllTypesId = typeof AllTypesIdSchema.Type;

export const AllTypes = getSchemas(_AllTypes, AllTypesIdSchema);

// Kysely table interface for AnnotationTest (internal)
interface AnnotationTestTable {
  age: number;
  coordinates: Array<number>;
  createdAt: ColumnType<Date, Date | undefined, Date | undefined>;
  email: string;
  id: ColumnType<string, never, never>;
  userId: string;
}

// AnnotationTest Base Schema (internal)
const _AnnotationTest = Schema.Struct({
  age: Schema.Number.pipe(Schema.positive()),
  coordinates: Schema.Array(Schema.Array(Schema.Number).pipe(Schema.itemsCount(3))),
  createdAt: generated(Schema.DateFromSelf),
  email: Schema.String,
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  userId: Schema.String.pipe(Schema.brand('UserId')),
});

const AnnotationTestIdSchema = Schema.UUID.pipe(Schema.brand('AnnotationTestId'));
export type AnnotationTestId = typeof AnnotationTestIdSchema.Type;

export const AnnotationTest = getSchemas(_AnnotationTest, AnnotationTestIdSchema);

// Kysely table interface for Category (internal)
interface CategoryTable {
  id: ColumnType<string, never, never>;
  name: string;
}

// Category Base Schema (internal)
const _Category = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
});

const CategoryIdSchema = Schema.UUID.pipe(Schema.brand('CategoryId'));
export type CategoryId = typeof CategoryIdSchema.Type;

export const Category = getSchemas(_Category, CategoryIdSchema);

// Kysely table interface for CompositeIdModel (internal)
interface CompositeIdModelTable {
  postId: string;
  timestamp: ColumnType<Date, Date | undefined, Date | undefined>;
  userId: string;
}

// CompositeIdModel Base Schema (internal)
const _CompositeIdModel = Schema.Struct({
  postId: Schema.UUID,
  timestamp: generated(Schema.DateFromSelf),
  userId: Schema.UUID,
});

export const CompositeIdModel = getSchemas(_CompositeIdModel);

// Kysely table interface for Employee (internal)
interface EmployeeTable {
  id: ColumnType<string, never, never>;
  managerId: string | null;
  name: string;
}

// Employee Base Schema (internal)
const _Employee = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  managerId: Schema.NullOr(Schema.UUID),
  name: Schema.String,
});

const EmployeeIdSchema = Schema.UUID.pipe(Schema.brand('EmployeeId'));
export type EmployeeId = typeof EmployeeIdSchema.Type;

export const Employee = getSchemas(_Employee, EmployeeIdSchema);

// Kysely table interface for Post (internal)
interface PostTable {
  authorId: string;
  content: string | null;
  createdAt: ColumnType<Date, Date | undefined, Date | undefined>;
  id: ColumnType<string, never, never>;
  published: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  title: string;
  updatedAt: ColumnType<Date, Date | undefined, Date | undefined>;
}

// Post Base Schema (internal)
const _Post = Schema.Struct({
  authorId: Schema.UUID,
  content: Schema.NullOr(Schema.String),
  createdAt: generated(Schema.DateFromSelf),
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  published: generated(Schema.Boolean),
  title: Schema.String,
  updatedAt: Schema.DateFromSelf,
});

const PostIdSchema = Schema.UUID.pipe(Schema.brand('PostId'));
export type PostId = typeof PostIdSchema.Type;

export const Post = getSchemas(_Post, PostIdSchema);

// Kysely table interface for Product (internal)
interface ProductTable {
  id: ColumnType<string, never, never>;
  name: string;
}

// Product Base Schema (internal)
const _Product = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
});

const ProductIdSchema = Schema.UUID.pipe(Schema.brand('ProductId'));
export type ProductId = typeof ProductIdSchema.Type;

export const Product = getSchemas(_Product, ProductIdSchema);

// Kysely table interface for ProductTag (internal)
interface ProductTagTable {
  id: ColumnType<string, never, never>;
  name: string;
}

// ProductTag Base Schema (internal)
const _ProductTag = Schema.Struct({
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
});

const ProductTagIdSchema = Schema.UUID.pipe(Schema.brand('ProductTagId'));
export type ProductTagId = typeof ProductTagIdSchema.Type;

export const ProductTag = getSchemas(_ProductTag, ProductTagIdSchema);

// Kysely table interface for Profile (internal)
interface ProfileTable {
  bio: string;
  id: ColumnType<string, never, never>;
  userId: string;
}

// Profile Base Schema (internal)
const _Profile = Schema.Struct({
  bio: Schema.String,
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  userId: Schema.UUID,
});

const ProfileIdSchema = Schema.UUID.pipe(Schema.brand('ProfileId'));
export type ProfileId = typeof ProfileIdSchema.Type;

export const Profile = getSchemas(_Profile, ProfileIdSchema);

// Kysely table interface for session_model_preference (internal)
interface SessionModelPreferenceTable {
  createdAt: ColumnType<Date, Date | undefined, Date | undefined>;
  id: ColumnType<string, never, never>;
  language: ColumnType<string, string | undefined, string | undefined>;
  notifications: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  theme: string;
  updatedAt: ColumnType<Date, Date | undefined, Date | undefined>;
  user_id: string;
}

// session_model_preference Base Schema (internal)
const _session_model_preference = Schema.Struct({
  createdAt: generated(Schema.DateFromSelf),
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  language: generated(Schema.String),
  notifications: generated(Schema.Boolean),
  theme: Schema.String,
  updatedAt: Schema.DateFromSelf,
  user_id: Schema.UUID,
});

const SessionModelPreferenceIdSchema = Schema.UUID.pipe(Schema.brand('SessionModelPreferenceId'));
export type SessionModelPreferenceId = typeof SessionModelPreferenceIdSchema.Type;

export const SessionModelPreference = getSchemas(
  _session_model_preference,
  SessionModelPreferenceIdSchema
);

// Kysely table interface for User (internal)
interface UserTable {
  createdAt: ColumnType<Date, Date | undefined, Date | undefined>;
  email: string;
  id: ColumnType<string, never, never>;
  name: string;
  updatedAt: ColumnType<Date, Date | undefined, Date | undefined>;
}

// User Base Schema (internal)
const _User = Schema.Struct({
  createdAt: generated(Schema.DateFromSelf),
  email: Schema.String,
  id: columnType(Schema.UUID, Schema.Never, Schema.Never),
  name: Schema.String,
  updatedAt: Schema.DateFromSelf,
});

const UserIdSchema = Schema.UUID.pipe(Schema.brand('UserId'));
export type UserId = typeof UserIdSchema.Type;

export const User = getSchemas(_User, UserIdSchema);

// Kysely table interface for CategoryToPost (internal)
interface CategoryToPostTable {
  category: ColumnType<string, never, never>;
  post: ColumnType<string, never, never>;
}

// Kysely table interface for product_tags (internal)
interface product_tagsTable {
  product: ColumnType<string, never, never>;
  product_tag: ColumnType<string, never, never>;
}

// _CategoryToPost Join Table Schema (internal)
// Database columns: A (Category), B (Post)
// TypeScript fields: category_id, post_id
const _CategoryToPost = Schema.Struct({
  category_id: Schema.propertySignature(columnType(Schema.UUID, Schema.Never, Schema.Never)).pipe(
    Schema.fromKey('A')
  ),
  post_id: Schema.propertySignature(columnType(Schema.UUID, Schema.Never, Schema.Never)).pipe(
    Schema.fromKey('B')
  ),
});

export const CategoryToPost = getSchemas(_CategoryToPost);

// _product_tags Join Table Schema (internal)
// Database columns: A (Product), B (ProductTag)
// TypeScript fields: product_id, product_tag_id
const _product_tags = Schema.Struct({
  product_id: Schema.propertySignature(columnType(Schema.UUID, Schema.Never, Schema.Never)).pipe(
    Schema.fromKey('A')
  ),
  product_tag_id: Schema.propertySignature(
    columnType(Schema.UUID, Schema.Never, Schema.Never)
  ).pipe(Schema.fromKey('B')),
});

export const product_tags = getSchemas(_product_tags);

// Kysely Database Interface
export interface DB {
  AllTypes: AllTypesTable;
  AnnotationTest: AnnotationTestTable;
  Category: CategoryTable;
  composite_id_table: CompositeIdModelTable;
  Employee: EmployeeTable;
  Post: PostTable;
  Product: ProductTable;
  ProductTag: ProductTagTable;
  Profile: ProfileTable;
  session_preferences: SessionModelPreferenceTable;
  User: UserTable;
  _CategoryToPost: CategoryToPostTable;
  _product_tags: product_tagsTable;
}
