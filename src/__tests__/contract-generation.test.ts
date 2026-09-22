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
    expect(dmmf.datamodel.models.some((model) => model.name === 'UserProducts')).toBe(false);
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

  it('generates one package per Prisma namespace when requested', async () => {
    await generateFromContract({ contractPath, schemaPath, outputPath, multiDomain: true });

    const generated = join(outputPath, 'public/src/generated');
    expect(existsSync(join(generated, 'enums.ts'))).toBe(true);
    expect(existsSync(join(generated, 'types.ts'))).toBe(true);
    expect(existsSync(join(generated, 'index.ts'))).toBe(true);
  });

  it('generates semantic codecs and physical native Kysely tables', async () => {
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
      amount: '42',
      metadata: { source: 'contract' },
      role: 'USER',
      seller_api_key_status: 'ACTIVE',
      created_at: createdAt,
    };

    expect(Schema.decodeUnknownSync(generated.User)(physical)).toEqual({
      id,
      displayName: 'Sam',
      displayAlias: null,
      amount: 42n,
      metadata: { source: 'contract' },
      role: 'USER',
      sellerApiKeyStatus: 'ACTIVE',
      createdAt,
    });
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
      amount: '42',
      metadata: null,
      role: 'ADMIN',
      seller_api_key_status: 'REVOKED',
    });
    expect(Schema.decodeUnknownSync(generated.UserProducts)({ A: productId, B: id })).toEqual({
      product_id: productId,
      user_id: id,
    });
  });
});
