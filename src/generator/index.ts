#!/usr/bin/env node

import { createRequire } from 'node:module';
import pkg from '@prisma/generator-helper';

import { GeneratorOrchestrator } from './orchestrator.js';

const { generatorHandler } = pkg;

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version: string };

// Re-export kysely helpers and type utilities for generated code
export type { Schemas, Selectable, Insertable, Updateable, Id } from '../kysely/helpers.js';
export { columnType, generated, getSchemas } from '../kysely/helpers.js';

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
