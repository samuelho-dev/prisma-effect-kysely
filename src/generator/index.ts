#!/usr/bin/env node

import { generatorHandler } from '@prisma/generator-helper';
import { GeneratorOrchestrator } from './orchestrator';
import packageJson from '../../package.json';

// Re-export kysely helpers for generated code
export * from '../kysely/helpers';

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
