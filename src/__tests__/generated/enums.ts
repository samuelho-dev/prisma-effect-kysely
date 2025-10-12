/**
 * Generated: 2025-10-12T08:18:15.745Z
 * DO NOT EDIT MANUALLY
 */

import * as Effect from 'effect';
const Schema = Effect.Schema;

export enum Role {
  ADMIN = 'ADMIN',
  GUEST = 'GUEST',
  USER = 'USER',
}

export namespace Role {
  export const Schema = Effect.Schema.Enums(Role);
  export type Type = Effect.Schema.Schema.Type<typeof Schema>;
}

export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

export namespace Status {
  export const Schema = Effect.Schema.Enums(Status);
  export type Type = Effect.Schema.Schema.Type<typeof Schema>;
}
