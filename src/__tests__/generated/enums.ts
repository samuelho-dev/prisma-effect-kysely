/**
 * Generated: 2025-10-13T06:40:37.763Z
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

// PascalCase aliases for better ergonomics
export const Role = Role;
export type Role = RoleType;

export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

export const StatusSchema = Schema.Enums(Status);

export type StatusType = Schema.Schema.Type<typeof StatusSchema>;

// PascalCase aliases for better ergonomics
export const Status = Status;
export type Status = StatusType;
