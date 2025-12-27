#!/usr/bin/env node

import { createRequire } from 'node:module';
import pkg from '@prisma/generator-helper';

import { GeneratorOrchestrator } from './orchestrator.js';

const { generatorHandler } = pkg;

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version: string };

export type { GetTypes, Schemas } from '../kysely/helpers.js';
// Re-export kysely helpers for generated code
export {
  columnType,
  generated,
  getSchemas,
  insertable,
  selectable,
  updateable,
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
