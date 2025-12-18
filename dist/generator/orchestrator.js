"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratorOrchestrator = void 0;
const file_manager_1 = require("../utils/file-manager");
const generator_1 = require("../prisma/generator");
const generator_2 = require("../effect/generator");
const generator_3 = require("../kysely/generator");
const config_1 = require("./config");
const domain_detector_1 = require("./domain-detector");
const contract_scaffolder_1 = require("./contract-scaffolder");
/**
 * Orchestrates the generation of Effect Schema types from Prisma schema
 * Uses domain-driven generators: Prisma → Effect → Kysely
 *
 * Supports two modes:
 * 1. Single output (default): All schemas in one directory
 * 2. Multi-domain: Separate contract libraries per domain
 */
class GeneratorOrchestrator {
    constructor(options) {
        this.config = (0, config_1.parseGeneratorConfig)(options);
        this.fileManager = new file_manager_1.FileManager(this.config.output);
        this.prismaGen = new generator_1.PrismaGenerator(options.dmmf);
        this.effectGen = new generator_2.EffectGenerator(options.dmmf);
        this.kyselyGen = new generator_3.KyselyGenerator(options.dmmf);
    }
    /**
     * Main generation entry point
     * Orchestrates all generation steps
     *
     * Flow:
     * 1. Detect domains if multi-domain mode enabled
     * 2. Scaffold contract libraries if scaffolding enabled
     * 3. Generate schemas (single or per-domain)
     */
    async generate(options) {
        this.logStart(options);
        // Check if multi-domain mode is enabled
        if ((0, config_1.isMultiDomainEnabled)(this.config)) {
            await this.generateMultiDomain(options);
        }
        else {
            await this.generateSingleOutput();
        }
        this.logComplete();
    }
    /**
     * Generate schemas in single-output mode (default)
     * All schemas in one directory
     */
    async generateSingleOutput() {
        // Ensure output directory exists
        await this.fileManager.ensureDirectory();
        // Generate all files in parallel for better performance
        await Promise.all([this.generateEnums(), this.generateTypes(), this.generateIndex()]);
    }
    /**
     * Generate schemas in multi-domain mode
     * Separate contract libraries per domain
     */
    async generateMultiDomain(options) {
        // 1. Detect domains from schema structure
        const schemaPath = options.schemaPath;
        const domains = (0, domain_detector_1.detectDomains)(options.dmmf, schemaPath);
        console.log(`[Multi-Domain] Detected ${domains.length} domains:`, domains.map(d => d.name).join(', '));
        // 2. Scaffold contract libraries if enabled
        if ((0, config_1.isScaffoldingEnabled)(this.config)) {
            const scaffoldResults = await (0, contract_scaffolder_1.scaffoldContractLibraries)(domains, this.config);
            (0, contract_scaffolder_1.logScaffoldResults)(scaffoldResults);
        }
        // 3. Generate schemas for each domain
        for (const domain of domains) {
            await this.generateForDomain(domain);
        }
    }
    /**
     * Generate schemas for a specific domain
     */
    async generateForDomain(domain) {
        const domainOutputPath = `${this.config.output}/${domain.name}/src/generated`;
        const domainFileManager = new file_manager_1.FileManager(domainOutputPath);
        await domainFileManager.ensureDirectory();
        console.log(`[Multi-Domain] Generating ${domain.name}...`);
        // Generate enums (shared across all domains for now)
        const enums = this.prismaGen.getEnums();
        if (enums.length > 0) {
            const enumsContent = this.effectGen.generateEnums(enums);
            await domainFileManager.writeFile('enums.ts', enumsContent);
        }
        // Generate types for this domain's models only
        const joinTables = this.prismaGen.getManyToManyJoinTables();
        const hasEnums = enums.length > 0;
        // Filter join tables to only those relevant to this domain
        const domainJoinTables = joinTables.filter(jt => domain.models.some(m => m.name === jt.modelA || m.name === jt.modelB));
        // Generate header with imports
        const header = this.effectGen.generateTypesHeader(hasEnums);
        // Generate model schemas for this domain only
        const modelSchemas = domain.models
            .map((model) => {
            const fields = this.prismaGen.getModelFields(model);
            const baseSchemaName = `_${model.name}`;
            // Generate Kysely table interface
            const kyselyTable = this.kyselyGen.generateTableInterface(model, fields);
            // Generate base schema with Kysely fields
            const kyselyFields = this.kyselyGen.generateModelFields(fields);
            const baseSchema = `// ${model.name} Base Schema
export const ${baseSchemaName} = Schema.Struct({
${kyselyFields}
});`;
            // Generate operational schemas and type exports
            const operationalSchema = this.effectGen.generateOperationalSchemas(model);
            const typeExports = this.effectGen.generateTypeExports(model, fields);
            return `${kyselyTable}\n\n${baseSchema}\n\n${operationalSchema}\n\n${typeExports}`;
        })
            .join('\n\n');
        // Generate join table Kysely interfaces for this domain
        const joinTableKyselyInterfaces = domainJoinTables.length > 0
            ? this.effectGen.generateJoinTableKyselyInterfaces(domainJoinTables)
            : '';
        // Generate join table schemas for this domain
        const joinTableSchemas = domainJoinTables.length > 0
            ? this.effectGen.generateJoinTableSchemas(domainJoinTables)
            : '';
        // Generate DB interface for this domain
        const dbInterface = this.kyselyGen.generateDBInterface(domain.models, domainJoinTables);
        // Assemble content with proper spacing
        let content = `${header}\n\n${modelSchemas}`;
        if (joinTableKyselyInterfaces) {
            content += `\n\n${joinTableKyselyInterfaces}`;
        }
        if (joinTableSchemas) {
            content += `\n\n${joinTableSchemas}`;
        }
        content += `\n\n${dbInterface}`;
        await domainFileManager.writeFile('types.ts', content);
        // Generate index file
        const indexContent = this.kyselyGen.generateIndexFile();
        await domainFileManager.writeFile('index.ts', indexContent);
        console.log(`[Multi-Domain] ✓ Generated ${domain.name} (${domain.models.length} models)`);
    }
    /**
     * Generate enums.ts file
     */
    async generateEnums() {
        const enums = this.prismaGen.getEnums();
        const content = this.effectGen.generateEnums(enums);
        await this.fileManager.writeFile('enums.ts', content);
    }
    /**
     * Generate types.ts file
     */
    async generateTypes() {
        const models = this.prismaGen.getModels();
        const joinTables = this.prismaGen.getManyToManyJoinTables();
        const hasEnums = this.prismaGen.getEnums().length > 0;
        // Generate header with imports
        const header = this.effectGen.generateTypesHeader(hasEnums);
        // Generate all model schemas (Kysely tables + Effect schemas)
        const modelSchemas = models
            .map((model) => {
            const fields = this.prismaGen.getModelFields(model);
            const baseSchemaName = `_${model.name}`;
            // Generate Kysely table interface
            const kyselyTable = this.kyselyGen.generateTableInterface(model, fields);
            // Generate base schema with Kysely fields
            const kyselyFields = this.kyselyGen.generateModelFields(fields);
            const baseSchema = `// ${model.name} Base Schema
export const ${baseSchemaName} = Schema.Struct({
${kyselyFields}
});`;
            // Generate operational schemas and type exports
            const operationalSchema = this.effectGen.generateOperationalSchemas(model);
            const typeExports = this.effectGen.generateTypeExports(model, fields);
            return `${kyselyTable}\n\n${baseSchema}\n\n${operationalSchema}\n\n${typeExports}`;
        })
            .join('\n\n');
        // Generate join table Kysely interfaces
        const joinTableKyselyInterfaces = joinTables.length > 0 ? this.effectGen.generateJoinTableKyselyInterfaces(joinTables) : '';
        // Generate join table schemas
        const joinTableSchemas = joinTables.length > 0 ? this.effectGen.generateJoinTableSchemas(joinTables) : '';
        // Generate DB interface with join tables
        const dbInterface = this.kyselyGen.generateDBInterface(models, joinTables);
        // Assemble content with proper spacing
        let content = `${header}\n\n${modelSchemas}`;
        if (joinTableKyselyInterfaces) {
            content += `\n\n${joinTableKyselyInterfaces}`;
        }
        if (joinTableSchemas) {
            content += `\n\n${joinTableSchemas}`;
        }
        content += `\n\n${dbInterface}`;
        await this.fileManager.writeFile('types.ts', content);
    }
    /**
     * Generate index.ts file
     */
    async generateIndex() {
        const content = this.kyselyGen.generateIndexFile();
        await this.fileManager.writeFile('index.ts', content);
    }
    /**
     * Log generation start with stats
     */
    logStart(options) {
        const modelCount = options.dmmf.datamodel.models.filter((m) => !m.name.startsWith('_')).length;
        const enumCount = options.dmmf.datamodel.enums.length;
        console.log('[Prisma Effect Kysely Generator] Starting generation...');
        console.log(`[Effect Generator] Processing ${modelCount} models, ${enumCount} enums`);
        if ((0, config_1.isMultiDomainEnabled)(this.config)) {
            console.log('[Effect Generator] Multi-domain mode: ENABLED');
            if ((0, config_1.isScaffoldingEnabled)(this.config)) {
                console.log('[Effect Generator] Library scaffolding: ENABLED');
            }
        }
    }
    /**
     * Log generation completion
     */
    logComplete() {
        const outputPath = this.fileManager.getOutputPath();
        if ((0, config_1.isMultiDomainEnabled)(this.config)) {
            console.log(`[Effect Generator] ✓ Multi-domain generation complete`);
            console.log(`[Effect Generator] Base output: ${this.config.output}`);
        }
        else {
            console.log(`[Effect Generator] ✓ Generated to ${outputPath}`);
            console.log(`[Effect Generator] Files: enums.ts, types.ts, index.ts`);
        }
    }
}
exports.GeneratorOrchestrator = GeneratorOrchestrator;
//# sourceMappingURL=orchestrator.js.map