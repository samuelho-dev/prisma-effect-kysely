#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generator = void 0;
const generator_helper_1 = require("@prisma/generator-helper");
const orchestrator_1 = require("./orchestrator");
exports.generator = (0, generator_helper_1.generatorHandler)({
    onManifest: () => ({
        version: '1.0.2',
        defaultOutput: './generated',
        prettyName: 'Prisma Effect Kysely Generator',
    }),
    onGenerate: async (options) => {
        const orchestrator = new orchestrator_1.GeneratorOrchestrator(options);
        await orchestrator.generate(options);
    },
});
//# sourceMappingURL=index.js.map