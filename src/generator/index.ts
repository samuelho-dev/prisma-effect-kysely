#!/usr/bin/env node

import { generatorHandler } from '@prisma/generator-helper';
import { createRequire } from 'node:module';

import { GeneratorOrchestrator } from './orchestrator.js';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version: string };

// Re-export kysely helpers for generated code
export * from '../kysely/helpers.js';

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
