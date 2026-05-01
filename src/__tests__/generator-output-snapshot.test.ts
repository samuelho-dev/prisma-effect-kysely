import { existsSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { DMMF, GeneratorOptions } from '@prisma/generator-helper';
import prismaInternals from '@prisma/internals';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GeneratorOrchestrator } from '../generator/orchestrator';

const { getDMMF } = prismaInternals;

/**
 * Generator output snapshot — pins emitted code shape byte-for-byte against
 * the v3 baseline. Phase 0.3 of the Effect v3→v4 migration.
 *
 * The v4 branch will intentionally update this snapshot when emit tokens swap
 * (Schema.String.check(Schema.isUUID()) → Schema.String.check(Schema.isUUID()), etc.). A human reviews
 * the diff before committing — the generated shape is the public contract for
 * downstream consumers.
 */

vi.mock('../utils/templates', () => ({
  formatCode: vi.fn((code: string) => Promise.resolve(code)),
}));

const FIXED_TIMESTAMP = '2024-01-01T00:00:00.000Z';
const HEADER_RE = /Generated: \d{4}-\d{2}-\d{2}T[\d:.]+Z/g;

const normalize = (s: string) => s.replace(HEADER_RE, `Generated: ${FIXED_TIMESTAMP}`);

describe('Generator output snapshot', () => {
  const outputPath = join(import.meta.dirname, '../test-output-snapshot');
  const fixturePath = join(import.meta.dirname, 'fixtures/test.prisma');

  let dmmf: DMMF.Document;

  beforeAll(async () => {
    const schemaContent = readFileSync(fixturePath, 'utf-8');
    dmmf = await getDMMF({ datamodel: schemaContent });
  });

  afterEach(async () => {
    if (existsSync(outputPath)) {
      await rm(outputPath, { recursive: true, force: true });
    }
  });

  it('matches snapshot for enums.ts, types.ts, and index.ts', async () => {
    const options: GeneratorOptions = {
      generator: { output: { value: outputPath } },
      dmmf,
    } as GeneratorOptions;

    const orchestrator = new GeneratorOrchestrator(options);
    await orchestrator.generate(options);

    const enumsContent = normalize(readFileSync(join(outputPath, 'enums.ts'), 'utf-8'));
    const typesContent = normalize(readFileSync(join(outputPath, 'types.ts'), 'utf-8'));
    const indexContent = normalize(readFileSync(join(outputPath, 'index.ts'), 'utf-8'));

    expect(enumsContent).toMatchSnapshot('enums.ts');
    expect(typesContent).toMatchSnapshot('types.ts');
    expect(indexContent).toMatchSnapshot('index.ts');
  });
});
