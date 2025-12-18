import type { GeneratorOptions } from '@prisma/generator-helper';
/**
 * Orchestrates the generation of Effect Schema types from Prisma schema
 * Uses domain-driven generators: Prisma → Effect → Kysely
 *
 * Supports two modes:
 * 1. Single output (default): All schemas in one directory
 * 2. Multi-domain: Separate contract libraries per domain
 */
export declare class GeneratorOrchestrator {
    private readonly config;
    private readonly fileManager;
    private readonly prismaGen;
    private readonly effectGen;
    private readonly kyselyGen;
    constructor(options: GeneratorOptions);
    /**
     * Main generation entry point
     * Orchestrates all generation steps
     *
     * Flow:
     * 1. Detect domains if multi-domain mode enabled
     * 2. Scaffold contract libraries if scaffolding enabled
     * 3. Generate schemas (single or per-domain)
     */
    generate(options: GeneratorOptions): Promise<void>;
    /**
     * Generate schemas in single-output mode (default)
     * All schemas in one directory
     */
    private generateSingleOutput;
    /**
     * Generate schemas in multi-domain mode
     * Separate contract libraries per domain
     */
    private generateMultiDomain;
    /**
     * Generate schemas for a specific domain
     */
    private generateForDomain;
    /**
     * Generate enums.ts file
     */
    private generateEnums;
    /**
     * Generate types.ts file
     */
    private generateTypes;
    /**
     * Generate index.ts file
     */
    private generateIndex;
    /**
     * Log generation start with stats
     */
    private logStart;
    /**
     * Log generation completion
     */
    private logComplete;
}
//# sourceMappingURL=orchestrator.d.ts.map