#!/usr/bin/env node

import { generatorHandler } from '@prisma/generator-helper';
import { GeneratorOrchestrator } from './orchestrator';

export const generator = generatorHandler({
  onManifest: () => ({
    version: '1.0.2',
    defaultOutput: './generated',
    prettyName: 'Prisma Effect Kysely Generator',
  }),
  onGenerate: async (options) => {
    const orchestrator = new GeneratorOrchestrator(options);
    await orchestrator.generate(options);
  },
});
