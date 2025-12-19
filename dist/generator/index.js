#!/usr/bin/env node
import { generatorHandler } from '@prisma/generator-helper';
import { GeneratorOrchestrator } from './orchestrator.js';
import packageJson from '../../package.json' with { type: 'json' };
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
//# sourceMappingURL=index.js.map