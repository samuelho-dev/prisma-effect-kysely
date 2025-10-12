/**
 * Generated: 2025-10-12T05:07:15.227Z
 * DO NOT EDIT MANUALLY
 */

import { Schema } from 'effect';

export enum Role {
  ADMIN = 'ADMIN',
  GUEST = 'GUEST',
  USER = 'USER',
}

export const RoleSchema = Schema.Enums(Role);

export type RoleType = Schema.Schema.Type<typeof RoleSchema>;

export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

export const StatusSchema = Schema.Enums(Status);

export type StatusType = Schema.Schema.Type<typeof StatusSchema>;
