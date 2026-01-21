#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '@prisma/generator-helper';

import { GeneratorOrchestrator } from './orchestrator.js';

const { generatorHandler } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
// Re-export kysely helpers and type utilities for generated code
export type { Generated, ColumnType, VariantMarker } from '../kysely/helpers.js';
export {
  columnType,
  generated,
  GeneratedId,
  ColumnTypeId,
  VariantTypeId,
  // Schema functions - also export types via value exports
  Selectable,
  Insertable,
  Updateable,
} from '../kysely/helpers.js';

export const generator = generatorHandler({
  onManifest: () => ({
    version: packageJson.version,
    defaultOutput: './generated',
    prettyName: 'Prisma Effect Kysely Generator',
  }),
  onGenerate: async (options) => {
    const orchestrator = new GeneratorOrchestrator(options);
    await orchestrator.generate(options);
  },
});
