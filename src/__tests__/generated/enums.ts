/**
 * Generated: 2026-01-09T22:45:16.364Z
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
