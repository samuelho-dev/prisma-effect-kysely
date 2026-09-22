import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { GeneratorOptions } from '@prisma/generator-helper';
import prismaInternals from '@prisma/internals';
import { Schema } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneratorOrchestrator } from '../generator/orchestrator';

const { getDMMF } = prismaInternals;
const runFile = promisify(execFile);

vi.mock('../utils/templates', () => ({
  formatCode: vi.fn((code: string) => Promise.resolve(code)),
}));

describe('implicit many-to-many generated contract', () => {
  const outputDir = join(import.meta.dirname, 'test-join-table-generation');

  beforeEach(async () => {
    const dmmf = await getDMMF({
      datamodel: `
        datasource db {
          provider = "postgresql"
        }

        model Product {
          id   String       @id @db.Uuid
          tags ProductTag[]
        }

        model ProductTag {
          id       String    @id @db.Uuid
          products Product[]
        }
      `,
    });
    const options: GeneratorOptions = {
      generator: { output: { value: outputDir } },
      dmmf,
    } as GeneratorOptions;

    await new GeneratorOrchestrator(options).generate(options);
  });

  afterEach(async () => {
    if (existsSync(outputDir)) {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('maps physical columns through select and insert codecs while retaining a native A/B table', async () => {
    // The generated module path exists only after this test's orchestration step.
    const generated = await import(pathToFileURL(join(outputDir, 'types.ts')).href);
    const productId = '123e4567-e89b-42d3-a456-426614174000';
    const productTagId = '123e4567-e89b-42d3-a456-426614174001';
    const physical = { A: productId, B: productTagId };
    const semantic = { product_id: productId, product_tag_id: productTagId };

    expect(Schema.decodeUnknownSync(generated.ProductToProductTag)(physical)).toEqual(semantic);
    expect(Schema.encodeSync(generated.ProductToProductTagInsert)(semantic)).toEqual(physical);
    expect(() =>
      Schema.decodeUnknownSync(generated.ProductToProductTagInsert)({ product_id: productId })
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(generated.ProductToProductTagInsert)({
        product_tag_id: productTagId,
      })
    ).toThrow();

    const consumerPath = join(outputDir, 'join-consumer.ts');
    const tsconfigPath = join(outputDir, 'tsconfig.json');
    await writeFile(
      consumerPath,
      `import { Kysely, type Insertable, type Selectable, type Updateable } from "kysely";
// @ts-expect-error implicit many-to-many tables expose no update codec.
import type { ProductToProductTagUpdate } from "./types.ts";
import type {
  DB,
  ProductId,
  ProductTagId,
  ProductToProductTag,
  ProductToProductTagInsert,
  ProductToProductTagTable,
} from "./types.ts";

type Assert<T extends true> = T;
type TableHasOnlyPhysicalColumns = Assert<
  Exclude<keyof ProductToProductTagTable, "A" | "B"> extends never
    ? "A" | "B" extends keyof ProductToProductTagTable
      ? true
      : false
    : false
>;

declare const productId: ProductId;
declare const productTagId: ProductTagId;
declare const db: Kysely<DB>;

const semantic: ProductToProductTag = {
  product_id: productId,
  product_tag_id: productTagId,
};
const insert: ProductToProductTagInsert = semantic;
const physicalInsert: Insertable<ProductToProductTagTable> = {
  A: productId,
  B: productTagId,
};
const physicalSelect: Selectable<ProductToProductTagTable> = {
  A: productId,
  B: productTagId,
};
const emptyUpdate: Updateable<ProductToProductTagTable> = {};

const unbrandedInsert: ProductToProductTagInsert = {
  // @ts-expect-error product_id must retain the ProductId brand.
  product_id: "123e4567-e89b-42d3-a456-426614174000",
  product_tag_id: productTagId,
};
// @ts-expect-error product_id is required for join inserts.
const missingProduct: ProductToProductTagInsert = { product_tag_id: productTagId };
// @ts-expect-error product_tag_id is required for join inserts.
const missingProductTag: ProductToProductTagInsert = { product_id: productId };
// @ts-expect-error join-table columns are never updateable.
db.updateTable("_ProductToProductTag").set({ A: productId });

db.insertInto("_ProductToProductTag").values(physicalInsert).returningAll();
db.updateTable("_ProductToProductTag").set(emptyUpdate).returningAll();
`,
      'utf8'
    );
    await writeFile(
      tsconfigPath,
      `${JSON.stringify(
        {
          extends: relative(outputDir, join(import.meta.dirname, '../../tsconfig.json')),
          compilerOptions: {
            noEmit: true,
            allowImportingTsExtensions: true,
          },
          include: ['types.ts', 'join-consumer.ts'],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    try {
      await runFile('./node_modules/.bin/tsc', ['--noEmit', '-p', tsconfigPath]);
    } catch (error) {
      if (error && typeof error === 'object') {
        const stdout = 'stdout' in error ? String(error.stdout) : '';
        const stderr = 'stderr' in error ? String(error.stderr) : '';
        throw new Error(stdout || stderr, { cause: error });
      }
      throw error;
    }
  });
});
