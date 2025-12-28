/**
 * Generated: 2025-12-28T22:44:45.388Z
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
