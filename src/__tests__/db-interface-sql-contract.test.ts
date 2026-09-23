import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { GeneratorOptions } from '@prisma/generator-helper';
import prismaInternals from '@prisma/internals';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GeneratorOrchestrator } from '../generator/orchestrator';

const { getDMMF } = prismaInternals;
const execFileAsync = promisify(execFile);

vi.mock('../utils/templates', () => ({
  formatCode: vi.fn((code: string) => Promise.resolve(code)),
}));

describe('DB interface SQL contract', () => {
  const testSchema = `
    datasource db {
      provider = "postgresql"
    }

    generator effectSchemas {
      provider = "prisma-effect-kysely"
      output   = "./test-db-interface-sql-contract"
    }

    model Account {
      id          String    @id @db.Uuid
      displayName String    @map("display_name")
      sequence    BigInt    @map("sequence_value")
      projects    Project[]

      @@map("account_records")
    }

    model Project {
      id        String  @id @db.Uuid
      accountId String  @db.Uuid @map("account_id")
      account   Account @relation(fields: [accountId], references: [id])
      labels    Label[] @relation("ProjectLabels")

      @@map("project_records")
    }

    model Label {
      id       String    @id @db.Uuid
      projects Project[] @relation("ProjectLabels")

      @@map("label_records")
    }

    model PublicUser {
      id String @id @db.Uuid
    }

    model AuditUser {
      id String @id @db.Uuid
    }
  `;
  const outputDir = path.join(import.meta.dirname, 'test-db-interface-sql-contract');
  const consumerPath = path.join(outputDir, 'sql-contract.ts');
  const tsconfigPath = path.join(outputDir, 'tsconfig.json');

  beforeAll(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });

    const dmmf = await getDMMF({ datamodel: testSchema });
    for (const [name, schema] of [
      ['PublicUser', 'public'],
      ['AuditUser', 'audit'],
    ] as const) {
      const model = dmmf.datamodel.models.find((candidate) => candidate.name === name);
      if (!model) throw new Error(`Expected ${name} model`);
      Object.assign(model, { dbName: 'user', schema });
    }
    const options: GeneratorOptions = {
      generator: { output: { value: outputDir } },
      dmmf,
    } as GeneratorOptions;
    await new GeneratorOrchestrator(options).generate(options);

    await Promise.all([
      fs.writeFile(
        consumerPath,
        `import { Schema } from "effect";
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import type { ColumnType } from "kysely";
import {
  AccountId,
  type AccountTable,
  type AuditUserTable,
  type DB,
  type ProjectLabelsTable,
  type PublicUserTable,
} from "./types.ts";

type Assert<T extends true> = T;
type AccountTableIsMapped = Assert<DB["account_records"] extends AccountTable ? true : false>;
type ProjectLabelsTableIsMapped = Assert<
  DB["_ProjectLabels"] extends ProjectLabelsTable ? true : false
>;
type PublicUserTableIsSchemaMapped = Assert<
  DB["public.user"] extends PublicUserTable ? true : false
>;
type AuditUserTableIsSchemaMapped = Assert<
  DB["audit.user"] extends AuditUserTable ? true : false
>;
type CollidingTablesAreQualified = Assert<"user" extends keyof DB ? false : true>;
type AccountSequenceUsesPgEncoding = Assert<
  DB["account_records"]["sequence_value"] extends ColumnType<string, string, string> ? true : false
>;
const accountId = Schema.decodeUnknownSync(AccountId)("88064e82-8bee-4776-8e7f-1e993a2d3b5f");

const db = new Kysely<DB>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (database) => new PostgresIntrospector(database),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

export const sql = {
  account: db
    .selectFrom("account_records")
    .select(["id", "display_name", "sequence_value"])
    .whereRef("display_name", "=", "display_name")
    .compile().sql,
  accountInsert: db
    .insertInto("account_records")
    .values({
      id: accountId,
      display_name: "Alicia",
      sequence_value: "1",
    })
    .compile().sql,
  publicUser: db.selectFrom("public.user").select("id").compile().sql,
  auditUser: db.selectFrom("audit.user").select("id").compile().sql,
  projectLabels: db
    .selectFrom("_ProjectLabels")
    .innerJoin("project_records", "project_records.id", "_ProjectLabels.B")
    .select(["_ProjectLabels.A", "_ProjectLabels.B", "project_records.account_id"])
    .whereRef("_ProjectLabels.A", "=", "_ProjectLabels.A")
    .compile().sql,
};
console.log(JSON.stringify(sql));
`
      ),
      fs.writeFile(
        tsconfigPath,
        JSON.stringify({
          extends: path.join(process.cwd(), 'tsconfig.json'),
          compilerOptions: {
            noEmit: true,
            allowImportingTsExtensions: true,
            types: ['node'],
          },
          include: ['./types.ts', './sql-contract.ts'],
        })
      ),
    ]);
  });

  afterAll(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  it('compiles mapped native tables with encoded BigInt rows and inserts', async () => {
    try {
      await execFileAsync('./node_modules/.bin/tsc', ['--noEmit', '-p', tsconfigPath], {
        cwd: process.cwd(),
      });
    } catch (error) {
      if (error && typeof error === 'object') {
        const stdout = 'stdout' in error ? String(error.stdout) : '';
        const stderr = 'stderr' in error ? String(error.stderr) : '';
        throw new Error(stdout || stderr, { cause: error });
      }
      throw error;
    }

    const { stdout } = await execFileAsync('bun', [consumerPath], { cwd: process.cwd() });
    const sql: {
      account: string;
      accountInsert: string;
      publicUser: string;
      auditUser: string;
      projectLabels: string;
    } = JSON.parse(stdout);

    expect(sql.account).toContain('"account_records"');
    expect(sql.account).toContain('"display_name"');
    expect(sql.account).not.toMatch(/\bdisplayName\b/);

    expect(sql.account).toContain('"sequence_value"');
    expect(sql.accountInsert).toContain('"sequence_value"');

    expect(sql.publicUser).toContain('"public"."user"');
    expect(sql.auditUser).toContain('"audit"."user"');

    expect(sql.projectLabels).toContain('"_ProjectLabels"');
    expect(sql.projectLabels).toContain('"A"');
    expect(sql.projectLabels).toContain('"B"');
    expect(sql.projectLabels).toContain('"project_records"."account_id"');
    expect(sql.projectLabels).not.toMatch(/\b(label_id|project_id)\b/);
  });
});
