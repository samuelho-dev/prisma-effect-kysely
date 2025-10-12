/**
 * Generated: 2025-10-12T09:16:58.943Z
 * DO NOT EDIT MANUALLY
 */

import { Schema } from 'effect';

/**
 * Role enum from Prisma schema.
 * @see {@link RoleSchema} for Effect Schema validation
 * @see {@link RoleType} for TypeScript type
 */
export enum Role {
  ADMIN = 'ADMIN',
  GUEST = 'GUEST',
  USER = 'USER',
}

/**
 * Effect Schema validator for Role enum.
 * Validates that a value is a valid Role enum member.
 *
 * @example
 * const validated = Schema.decodeSync(RoleSchema)("ADMIN");
 */
export const RoleSchema = Schema.Enums(Role);

/**
 * TypeScript type for Role enum values.
 * Equivalent to: 'ADMIN' | 'GUEST' | 'USER'
 */
export type RoleType = Schema.Schema.Type<typeof RoleSchema>;

/**
 * Status enum from Prisma schema.
 * @see {@link StatusSchema} for Effect Schema validation
 * @see {@link StatusType} for TypeScript type
 */
export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

/**
 * Effect Schema validator for Status enum.
 * Validates that a value is a valid Status enum member.
 *
 * @example
 * const validated = Schema.decodeSync(StatusSchema)("ACTIVE");
 */
export const StatusSchema = Schema.Enums(Status);

/**
 * TypeScript type for Status enum values.
 * Equivalent to: 'active' | 'inactive' | 'pending'
 */
export type StatusType = Schema.Schema.Type<typeof StatusSchema>;
