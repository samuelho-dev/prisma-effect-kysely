import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { DMMF, GeneratorOptions } from '@prisma/generator-helper';
import prismaInternals from '@prisma/internals';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GeneratorOrchestrator } from '../generator/orchestrator';

const { getDMMF } = prismaInternals;
const execFileAsync = promisify(execFile);

vi.mock('../utils/templates', () => ({
  formatCode: vi.fn((code: string) => Promise.resolve(code)),
}));

describe('generated consumer contract', () => {
  const testOutputPath = join(import.meta.dirname, '../test-output-codegen');
  const fixtureSchemaPath = join(import.meta.dirname, 'fixtures/test.prisma');
  let dmmf: DMMF.Document;

  const optionsFor = (document: DMMF.Document): GeneratorOptions =>
    ({
      generator: { output: { value: testOutputPath } },
      dmmf: document,
    }) as GeneratorOptions;

  const generate = async (document = dmmf) => {
    const options = optionsFor(document);
    await new GeneratorOrchestrator(options).generate(options);
  };

  beforeAll(async () => {
    dmmf = await getDMMF({ datamodel: readFileSync(fixtureSchemaPath, 'utf8') });
  });

  afterEach(async () => {
    await rm(testOutputPath, { recursive: true, force: true });
  });

  afterAll(() => {
    dmmf = undefined;
  });

  it('writes the public generated files and direct operation exports', async () => {
    await generate();

    const indexPath = join(testOutputPath, 'index.ts');
    expect(existsSync(join(testOutputPath, 'enums.ts'))).toBe(true);
    expect(existsSync(join(testOutputPath, 'types.ts'))).toBe(true);
    expect(existsSync(indexPath)).toBe(true);

    // Static imports cannot target generated files that only exist after this test starts.
    const generated = await import(`${pathToFileURL(indexPath).href}?public-contract`);
    expect(generated).toHaveProperty('Effect4Contract');
    expect(generated).toHaveProperty('Effect4ContractInsert');
    expect(generated).toHaveProperty('Effect4ContractUpdate');
    expect(generated).toHaveProperty('Role');
    expect(generated).not.toHaveProperty('SharedProfileId');
    expect(generated).not.toHaveProperty('SharedProfileAuditId');
  });

  it('rejects a missing output directory', async () => {
    const options = {
      generator: { output: null },
      dmmf,
    } as GeneratorOptions;

    expect(() => new GeneratorOrchestrator(options)).toThrow(
      'Prisma Effect Generator: output path not configured'
    );
  });

  it('writes an empty public output for an empty DMMF', async () => {
    const emptyDmmf = {
      datamodel: { models: [], enums: [] },
    } as unknown as DMMF.Document;

    await generate(emptyDmmf);

    expect(existsSync(join(testOutputPath, 'enums.ts'))).toBe(true);
    expect(existsSync(join(testOutputPath, 'types.ts'))).toBe(true);
    expect(existsSync(join(testOutputPath, 'index.ts'))).toBe(true);
  });

  it('compiles and runs a mapped Effect 4 and native Kysely consumer', async () => {
    await generate();

    const consumerPath = join(testOutputPath, 'consumer.ts');
    const smokePath = join(testOutputPath, 'smoke.ts');
    const tsconfigPath = join(testOutputPath, 'tsconfig.json');

    await writeFile(
      consumerPath,
      `import {
  Effect4Contract,
  Effect4ContractInsert,
  Effect4ContractUpdate,
  Role,
  type CompositeIdModelUpdate,
  type DB,
  type UserId,
} from "./index.ts";
import type { Insertable, Kysely, Selectable, Updateable } from "kysely";

const selectCodec = Effect4Contract;
const insertCodec = Effect4ContractInsert;
const updateCodec = Effect4ContractUpdate;
const roleCodec = Role;
void selectCodec;
void insertCodec;
void updateCodec;
void roleCodec;

declare const db: Kysely<DB>;
declare const selected: Selectable<DB["effect4_contract"]>;
declare const decoded: Effect4Contract;
const selectedId: Effect4Contract["id"] = selected.id;
const selectedAmount: bigint = selected.amount;
void selectedId;
void selectedAmount;
declare const sharedProfile: Selectable<DB["SharedProfile"]>;
const sharedProfileUserId: UserId = sharedProfile.user_id;
void sharedProfileUserId;
declare const sharedProfileAudit: Selectable<DB["SharedProfileAudit"]>;
const auditUserId: UserId = sharedProfileAudit.user_id;
void auditUserId;
void decoded;

const databaseInsert: Insertable<DB["effect4_contract"]> = {
  prisma_id: "prisma-default-required",
  db_name: "required name",
  count: 7,
  amount: 42n,
  metadata: { nested: ["json", true, null] },
  updated_at: new Date("2025-01-02T03:04:05.000Z"),
};
const databaseUpdate: Updateable<DB["effect4_contract"]> = {
  db_name: "renamed",
  amount: 1n,
};

const insertQuery = db.insertInto("effect4_contract").values(databaseInsert).returningAll();
const updateQuery = db.updateTable("effect4_contract").set(databaseUpdate).returningAll();
const selectQuery = db.selectFrom("effect4_contract").selectAll();
void insertQuery;
void updateQuery;
void selectQuery;

// @ts-expect-error Prisma Client defaults are not database defaults.
const missingPrismaId: Effect4ContractInsert = {
  name: "required name",
  count: 7,
  amount: 42n,
  metadata: {},
  updatedAt: new Date("2025-01-02T03:04:05.000Z"),
};

// @ts-expect-error Bare @updatedAt values remain required inserts.
const missingUpdatedAt: Effect4ContractInsert = {
  prismaId: "prisma-default-required",
  name: "required name",
  count: 7,
  amount: 42n,
  metadata: {},
};

// @ts-expect-error Primary keys are never updateable.
const primaryKeyUpdate: Effect4ContractUpdate = { id: "not-updateable" };

// @ts-expect-error Every component of a composite primary key is absent from updates.
const compositeKeyUpdate: CompositeIdModelUpdate = { userId: "not-updateable" };

// @ts-expect-error Optional update keys reject explicit undefined.
const explicitUndefined: Effect4ContractUpdate = { name: undefined };
void missingPrismaId;
void missingUpdatedAt;
void primaryKeyUpdate;
void compositeKeyUpdate;
void explicitUndefined;
`
    );

    await writeFile(
      tsconfigPath,
      JSON.stringify(
        {
          extends: '../../tsconfig.json',
          compilerOptions: {
            noEmit: true,
            allowImportingTsExtensions: true,
            types: ['node'],
          },
          include: ['./enums.ts', './types.ts', './index.ts', './consumer.ts'],
        },
        null,
        2
      )
    );

    await writeFile(
      smokePath,
      `import { deepStrictEqual, equal, throws } from "node:assert/strict";
import { Schema } from "effect";
import { Effect4Contract, Effect4ContractInsert, Effect4ContractUpdate } from "./index.ts";

const id = "123e4567-e89b-12d3-a456-426614174000";
const createdAt = new Date("2025-01-02T03:04:05.000Z");
const updatedAt = new Date("2025-02-03T04:05:06.000Z");
const metadata = { nested: { values: [1, true, null] } };

const physical = {
  id,
  prisma_id: "prisma-default-required",
  db_name: "required name",
  nickname: null,
  count: 7,
  amount: "42",
  metadata,
  created_at: createdAt,
  updated_at: updatedAt,
};
const decoded = Schema.decodeUnknownSync(Effect4Contract)(physical);
deepStrictEqual(decoded, {
  id,
  prismaId: "prisma-default-required",
  name: "required name",
  nickname: null,
  count: 7,
  amount: 42n,
  metadata,
  createdAt,
  updatedAt,
});
equal(decoded.createdAt, createdAt);
equal(decoded.updatedAt, updatedAt);

const encoded = Schema.encodeSync(Effect4ContractInsert)({
  prismaId: "prisma-default-required",
  name: "required name",
  count: 7,
  amount: 42n,
  metadata,
  updatedAt,
});
deepStrictEqual(encoded, {
  prisma_id: "prisma-default-required",
  db_name: "required name",
  count: 7,
  amount: "42",
  metadata,
  updated_at: updatedAt,
});
equal(encoded.updated_at, updatedAt);

throws(() =>
  Schema.decodeUnknownSync(Effect4Contract)({ ...physical, id: "not-a-uuid" })
);
throws(() =>
  Schema.decodeUnknownSync(Effect4Contract)({ ...physical, count: 1.5 })
);
throws(() =>
  Schema.decodeUnknownSync(Effect4Contract)({
    ...physical,
    created_at: createdAt.toISOString(),
  })
);
throws(() => Schema.decodeUnknownSync(Effect4ContractUpdate)({ db_name: undefined }));
`
    );

    try {
      const { stderr } = await execFileAsync(
        './node_modules/.bin/tsc',
        ['--noEmit', '-p', tsconfigPath],
        { cwd: process.cwd() }
      );
      expect(stderr).toBe('');
    } catch (error) {
      if (error && typeof error === 'object') {
        const stdout = 'stdout' in error ? String(error.stdout) : '';
        const stderr = 'stderr' in error ? String(error.stderr) : '';
        throw new Error(stdout || stderr, { cause: error });
      }
      throw error;
    }
    await execFileAsync('bun', [smokePath], { cwd: process.cwd() });
  }, 30_000);
});
