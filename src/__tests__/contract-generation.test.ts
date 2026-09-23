import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Schema } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contractToDmmf } from '../contract/adapter';
import { generateFromContract } from '../contract/generator';
import { buildForeignKeyMap } from '../prisma/relation';

vi.mock('../utils/templates', () => ({
  formatCode: vi.fn((code: string) => Promise.resolve(code)),
}));

describe('Prisma 8 contract generation', () => {
  const fixtures = join(import.meta.dirname, 'fixtures/contract');
  const contractPath = join(fixtures, 'contract.json');
  const schemaPath = join(fixtures, 'contract.prisma');
  const outputPath = join(import.meta.dirname, '../test-output-contract');

  afterEach(async () => {
    await rm(outputPath, { recursive: true, force: true });
  });

  it('adapts contract storage metadata into the established generator model', async () => {
    const dmmf = contractToDmmf(
      await readFile(contractPath, 'utf8'),
      await readFile(schemaPath, 'utf8')
    );
    const user = dmmf.datamodel.models.find((model) => model.name === 'User');
    const product = dmmf.datamodel.models.find((model) => model.name === 'Product');
    const sharedProfile = dmmf.datamodel.models.find((model) => model.name === 'SharedProfile');

    expect(user?.dbName).toBe('user');
    expect(user?.primaryKey?.fields).toEqual(['id']);
    expect(user?.fields.find((field) => field.name === 'displayName')).toMatchObject({
      dbName: 'display_name',
      documentation: "@customType(Schema.String.pipe(Schema.brand('DisplayName')))",
    });
    expect(user?.fields.find((field) => field.name === 'displayAlias')).toMatchObject({
      dbName: 'display_alias',
      documentation: "@customType(Schema.String.pipe(Schema.brand('DisplayName')))",
      isRequired: false,
    });
    expect(user?.fields.find((field) => field.name === 'id')).toMatchObject({
      isId: true,
      hasDefaultValue: true,
      nativeType: ['Uuid', []],
    });
    expect(product?.fields.find((field) => field.name === 'ownerId')).toMatchObject({
      dbName: 'owner_id',
      type: 'String',
    });
    expect(buildForeignKeyMap(user!, dmmf.datamodel.models).has('id')).toBe(false);
    expect(buildForeignKeyMap(sharedProfile!, dmmf.datamodel.models).get('userId')).toBe('User');
    expect(dmmf.datamodel.models.some((model) => model.name === 'UserProducts')).toBe(true);
    expect(dmmf.datamodel.enums).toEqual([
      {
        name: 'ROLE',
        dbName: null,
        values: [
          { name: 'USER', dbName: 'USER' },
          { name: 'ADMIN', dbName: 'ADMIN' },
        ],
      },
      {
        name: 'SELLER_API_KEY_STATUS',
        dbName: 'seller_api_key_status',
        values: [
          { name: 'ACTIVE', dbName: 'ACTIVE' },
          { name: 'REVOKED', dbName: 'REVOKED' },
        ],
      },
    ]);
  });

  it('adapts finite domain enums and PostgreSQL scalar codecs', () => {
    const fields = {
      status: {
        nullable: false,
        type: { codecId: 'pg/int4@1', kind: 'scalar' },
        valueSet: {
          plane: 'domain',
          entityKind: 'enum',
          namespaceId: 'public',
          entityName: 'Status',
        },
      },
      amount: { nullable: false, type: { codecId: 'pg/numeric@1', kind: 'scalar' } },
      char: { nullable: false, type: { codecId: 'sql/char@1', kind: 'scalar' } },
      safeBigInt: { nullable: false, type: { codecId: 'pg/int8number@1', kind: 'scalar' } },
      bytes: { nullable: false, type: { codecId: 'pg/bytea@1', kind: 'scalar' } },
      date: { nullable: false, type: { codecId: 'pg/date-temporal@1', kind: 'scalar' } },
      timestamp: {
        nullable: false,
        type: { codecId: 'pg/timestamp-temporal@1', kind: 'scalar' },
      },
      timestampString: {
        nullable: false,
        type: { codecId: 'pg/timestamp-string@1', kind: 'scalar' },
      },
      instant: {
        nullable: false,
        type: { codecId: 'pg/timestamptz-temporal@1', kind: 'scalar' },
      },
      instantString: {
        nullable: false,
        type: { codecId: 'pg/timestamptz-string@1', kind: 'scalar' },
      },
      time: { nullable: false, type: { codecId: 'pg/time-temporal@1', kind: 'scalar' } },
      duration: { nullable: false, type: { codecId: 'pg/interval@1', kind: 'scalar' } },
    };
    const columns = Object.fromEntries(
      Object.entries(fields).map(([name, field]) => [
        name,
        { codecId: field.type.codecId, nullable: false },
      ])
    );
    const dmmf = contractToDmmf(
      JSON.stringify({
        schemaVersion: '1',
        targetFamily: 'sql',
        target: 'postgres',
        domain: {
          namespaces: {
            public: {
              enum: {
                Status: {
                  codecId: 'pg/int4@1',
                  members: [
                    { name: 'ACTIVE', value: 1 },
                    { name: 'ARCHIVED', value: 2 },
                  ],
                },
                UnusedStatus: {
                  codecId: 'pg/text@1',
                  members: [{ name: 'PENDING', value: 'pending' }],
                },
              },
              models: {
                Sample: {
                  fields,
                  storage: {
                    fields: Object.fromEntries(
                      Object.keys(fields).map((name) => [name, { column: name }])
                    ),
                    namespaceId: 'public',
                    table: 'sample',
                  },
                },
              },
            },
          },
        },
        storage: {
          namespaces: {
            public: {
              entries: {
                table: { sample: { columns } },
                valueSet: { Status: { kind: 'valueSet', values: [1, 2] } },
              },
            },
          },
        },
      })
    );

    const sample = dmmf.datamodel.models[0]!;
    expect(sample.fields.map((field) => [field.name, field.kind, field.type])).toEqual([
      ['status', 'enum', 'Status'],
      ['amount', 'scalar', 'Decimal'],
      ['char', 'scalar', 'String'],
      ['safeBigInt', 'scalar', 'Int'],
      ['bytes', 'scalar', 'Bytes'],
      ['date', 'scalar', 'String'],
      ['timestamp', 'scalar', 'DateTime'],
      ['timestampString', 'scalar', 'DateTime'],
      ['instant', 'scalar', 'DateTime'],
      ['instantString', 'scalar', 'DateTime'],
      ['time', 'scalar', 'String'],
      ['duration', 'scalar', 'Interval'],
    ]);
    expect(dmmf.datamodel.enums).toEqual([
      {
        name: 'Status',
        dbName: null,
        values: [
          { name: 'ACTIVE', dbName: 1 },
          { name: 'ARCHIVED', dbName: 2 },
        ],
      },
      {
        name: 'UnusedStatus',
        dbName: null,
        values: [{ name: 'PENDING', dbName: 'pending' }],
      },
    ]);
  });

  it('keeps duplicate namespace models and explicitly mapped underscore tables', () => {
    const scalar = (codecId = 'pg/uuid@1') => ({
      nullable: false,
      type: { codecId, kind: 'scalar' },
    });
    const dmmf = contractToDmmf(
      JSON.stringify({
        schemaVersion: '1',
        targetFamily: 'sql',
        target: 'postgres',
        domain: {
          namespaces: {
            public: {
              models: {
                User: {
                  fields: { id: scalar() },
                  storage: {
                    fields: { id: { column: 'id' } },
                    namespaceId: 'public',
                    table: 'user',
                  },
                },
                PublicUser: {
                  fields: { id: scalar() },
                  storage: {
                    fields: { id: { column: 'id' } },
                    namespaceId: 'public',
                    table: 'public_user',
                  },
                },
                AB: {
                  fields: { a: scalar(), b: scalar() },
                  storage: {
                    fields: { a: { column: 'A' }, b: { column: 'B' } },
                    namespaceId: 'public',
                    table: '_AtoB',
                  },
                },
              },
            },
            audit: {
              models: {
                User: {
                  fields: { id: scalar() },
                  storage: {
                    fields: { id: { column: 'id' } },
                    namespaceId: 'audit',
                    table: 'user',
                  },
                },
                Entry: {
                  fields: { ownerId: scalar() },
                  relations: {
                    owner: {
                      cardinality: 'N:1',
                      on: { localFields: ['ownerId'], targetFields: ['id'] },
                      to: { namespace: 'public', model: 'User' },
                    },
                  },
                  storage: {
                    fields: { ownerId: { column: 'owner_id' } },
                    namespaceId: 'audit',
                    table: 'entry',
                  },
                },
              },
            },
          },
        },
        storage: {
          namespaces: {
            public: {
              entries: {
                table: {
                  user: { columns: { id: { codecId: 'pg/uuid@1', nullable: false } } },
                  public_user: {
                    columns: { id: { codecId: 'pg/uuid@1', nullable: false } },
                  },
                  _AtoB: {
                    columns: {
                      A: { codecId: 'pg/uuid@1', nullable: false },
                      B: { codecId: 'pg/uuid@1', nullable: false },
                    },
                  },
                },
              },
            },
            audit: {
              entries: {
                table: {
                  user: { columns: { id: { codecId: 'pg/uuid@1', nullable: false } } },
                  entry: { columns: { owner_id: { codecId: 'pg/uuid@1', nullable: false } } },
                },
              },
            },
          },
        },
      })
    );

    expect(dmmf.datamodel.models.map((model) => [model.name, model.schema, model.dbName])).toEqual([
      ['public_User_2', 'public', 'user'],
      ['PublicUser', 'public', 'public_user'],
      ['AB', 'public', '_AtoB'],
      ['audit_User', 'audit', 'user'],
      ['Entry', 'audit', 'entry'],
    ]);
    expect(dmmf.datamodel.models.find((model) => model.name === 'Entry')?.fields).toContainEqual(
      expect.objectContaining({ name: 'owner', type: 'public_User_2' })
    );
  });

  it('generates one package per Prisma namespace when requested', async () => {
    await generateFromContract({ contractPath, schemaPath, outputPath, multiDomain: true });

    const generated = join(outputPath, 'public/src/generated');
    expect(existsSync(join(generated, 'enums.ts'))).toBe(true);
    expect(existsSync(join(generated, 'types.ts'))).toBe(true);
    expect(existsSync(join(generated, 'index.ts'))).toBe(true);
  });

  it('generates driver-native codecs and physical Kysely tables without value coercion', async () => {
    await generateFromContract({ contractPath, schemaPath, outputPath });

    expect(existsSync(join(outputPath, 'enums.ts'))).toBe(true);
    expect(existsSync(join(outputPath, 'types.ts'))).toBe(true);
    expect(existsSync(join(outputPath, 'index.ts'))).toBe(true);

    const generated = await import(`${pathToFileURL(join(outputPath, 'index.ts')).href}?contract`);
    const id = '00000000-0000-4000-8000-000000000001';
    const productId = '00000000-0000-4000-8000-000000000002';
    const createdAt = new Date('2026-09-22T00:00:00.000Z');
    const physical = {
      id,
      display_name: 'Sam',
      display_alias: null,
      amount: 42n,
      metadata: { source: 'contract' },
      role: 'USER',
      seller_api_key_status: 'ACTIVE',
      created_at: createdAt,
    };

    const decoded = Schema.decodeUnknownSync(generated.User)(physical);
    expect(decoded).toEqual({
      id,
      displayName: 'Sam',
      displayAlias: null,
      amount: 42n,
      metadata: { source: 'contract' },
      role: 'USER',
      sellerApiKeyStatus: 'ACTIVE',
      createdAt,
    });
    expect(decoded.createdAt).toBe(createdAt);
    expect(
      Schema.encodeUnknownSync(generated.UserInsert)({
        displayName: 'Sam',
        displayAlias: null,
        amount: 42n,
        metadata: null,
        role: 'ADMIN',
        sellerApiKeyStatus: 'REVOKED',
      })
    ).toEqual({
      display_name: 'Sam',
      display_alias: null,
      amount: 42n,
      metadata: null,
      role: 'ADMIN',
      seller_api_key_status: 'REVOKED',
    });
    expect(() => Schema.decodeUnknownSync(generated.User)({ ...physical, amount: '42' })).toThrow();
    expect(Schema.decodeUnknownSync(generated.UserProducts)({ A: productId, B: id })).toEqual({
      a: productId,
      b: id,
    });
  });
});
