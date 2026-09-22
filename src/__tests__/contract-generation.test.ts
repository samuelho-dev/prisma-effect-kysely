import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Schema } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contractToDmmf } from '../contract/adapter';
import { generateFromContract } from '../contract/generator';

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

    expect(user?.dbName).toBe('user');
    expect(user?.primaryKey?.fields).toEqual(['id']);
    expect(user?.fields.find((field) => field.name === 'displayName')).toMatchObject({
      dbName: 'display_name',
      documentation: "@customType(Schema.String.pipe(Schema.brand('DisplayName')))",
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
    ]);
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
      amount: '42',
      metadata: { source: 'contract' },
      role: 'USER',
      created_at: createdAt,
    };

    expect(Schema.decodeUnknownSync(generated.User)(physical)).toEqual({
      id,
      displayName: 'Sam',
      amount: 42n,
      metadata: { source: 'contract' },
      role: 'USER',
      createdAt,
    });
    expect(
      Schema.encodeUnknownSync(generated.UserInsert)({
        displayName: 'Sam',
        amount: 42n,
        metadata: null,
        role: 'ADMIN',
      })
    ).toEqual({
      display_name: 'Sam',
      amount: '42',
      metadata: null,
      role: 'ADMIN',
    });
    expect(Schema.decodeUnknownSync(generated.UserProducts)({ A: productId, B: id })).toEqual({
      product_id: productId,
      user_id: id,
    });
  });
});
