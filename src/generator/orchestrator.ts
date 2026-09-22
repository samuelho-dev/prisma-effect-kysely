import type { GeneratorOptions } from '@prisma/generator-helper';
import { EffectGenerator } from '../effect/generator.js';
import { KyselyGenerator } from '../kysely/generator.js';
import { PrismaGenerator } from '../prisma/generator.js';
import { FileManager } from '../utils/file-manager.js';
import { type GeneratorConfig, isMultiDomainEnabled, parseGeneratorConfig } from './config.js';
import { type DomainInfo, detectDomains } from './domain-detector.js';

/**
 * Orchestrates the generation of Effect Schema types from Prisma schema
 * Uses domain-driven generators: Prisma → Effect → Kysely
 *
 * Supports two modes:
 * 1. Single output (default): All schemas in one directory
 * 2. Multi-domain: Separate contract libraries per domain
 */
export class GeneratorOrchestrator {
  private readonly config: GeneratorConfig;
  private readonly fileManager: FileManager;
  private readonly prismaGen: PrismaGenerator;
  private readonly effectGen: EffectGenerator;
  private readonly kyselyGen: KyselyGenerator;

  constructor(options: GeneratorOptions) {
    this.config = parseGeneratorConfig(options);

    this.fileManager = new FileManager(this.config.output);
    this.prismaGen = new PrismaGenerator(options.dmmf);
    this.effectGen = new EffectGenerator(options.dmmf);
    this.kyselyGen = new KyselyGenerator();
  }

  /**
   * Main generation entry point
   * Orchestrates all generation steps
   *
   * 1. Group models by namespace when multi-domain mode is enabled.
   * 2. Generate schemas in one output or split by namespace.
   */
  async generate(options: GeneratorOptions) {
    // Check if multi-domain mode is enabled
    if (isMultiDomainEnabled(this.config)) {
      await this.generateMultiDomain(options);
    } else {
      await this.generateSingleOutput();
    }
  }

  /**
   * Generate schemas in single-output mode (default)
   */
  private async generateSingleOutput() {
    // Ensure output directory exists
    await this.fileManager.ensureDirectory();

    // Generate all files in parallel for better performance
    await Promise.all([this.generateEnums(), this.generateTypes(), this.generateIndex()]);
  }

  /**
   * Generate schemas in multi-domain mode
   * Separate contract libraries per domain
   */
  private async generateMultiDomain(options: GeneratorOptions) {
    const domains = detectDomains(options.dmmf);

    for (const domain of domains) {
      await this.generateForDomain(domain);
    }
  }

  /**
   * Generate schemas for a specific domain
   */
  private async generateForDomain(domain: DomainInfo) {
    const domainOutputPath = `${this.config.output}/${domain.name}/src/generated`;
    const domainFileManager = new FileManager(domainOutputPath);

    await domainFileManager.ensureDirectory();

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
    const domainJoinTables = joinTables.filter((jt) =>
      domain.models.some((m) => m.name === jt.modelA || m.name === jt.modelB)
    );

    // Generate header with imports
    const header = this.effectGen.generateTypesHeader(hasEnums);

    // Generate branded ID schemas before codecs that reference them.
    const allBrandedIdSchemas = domain.models
      .map((model) => {
        const fields = this.prismaGen.getModelFields(model);
        return this.effectGen.generateBrandedIdSchema(model, fields);
      })
      .filter((schema): schema is string => schema !== null)
      .join('\n\n');

    // Generate operation codecs for each model.
    const modelSchemas = domain.models
      .map((model) => {
        const fields = this.prismaGen.getModelFields(model);
        return this.effectGen.generateModelSchema(model, fields);
      })
      .join('\n\n');

    // Generate join table schemas for this domain
    const joinTableSchemas =
      domainJoinTables.length > 0 ? this.effectGen.generateJoinTableSchemas(domainJoinTables) : '';

    // Generate native Kysely table interfaces and the DB map.
    const dbInterface = this.kyselyGen.generateDBInterface(domain.models, domainJoinTables);

    // Assemble content with proper spacing
    let content = `${header}`;
    if (allBrandedIdSchemas) {
      content += `\n\n// ===== Branded ID Schemas =====\n${allBrandedIdSchemas}`;
    }
    content += `\n\n// ===== Model Schemas =====\n${modelSchemas}`;
    if (joinTableSchemas) {
      content += `\n\n${joinTableSchemas}`;
    }
    content += `\n\n${dbInterface}`;

    await domainFileManager.writeFile('types.ts', content);

    // Generate index file
    const indexContent = this.kyselyGen.generateIndexFile();
    await domainFileManager.writeFile('index.ts', indexContent);
  }

  /**
   * Generate enums.ts file
   */
  private async generateEnums() {
    const enums = this.prismaGen.getEnums();
    const content = this.effectGen.generateEnums(enums);
    await this.fileManager.writeFile('enums.ts', content);
  }

  /**
   * Generate types.ts file
   */
  private async generateTypes() {
    const models = this.prismaGen.getModels();
    const joinTables = this.prismaGen.getManyToManyJoinTables();
    const hasEnums = this.prismaGen.getEnums().length > 0;

    // Generate header with imports
    const header = this.effectGen.generateTypesHeader(hasEnums);

    // Generate branded ID schemas before codecs that reference them.
    const allBrandedIdSchemas = models
      .map((model) => {
        const fields = this.prismaGen.getModelFields(model);
        return this.effectGen.generateBrandedIdSchema(model, fields);
      })
      .filter((schema): schema is string => schema !== null)
      .join('\n\n');

    // Generate operation codecs for each model.
    const modelSchemas = models
      .map((model) => {
        const fields = this.prismaGen.getModelFields(model);
        return this.effectGen.generateModelSchema(model, fields);
      })
      .join('\n\n');

    // Generate join table schemas
    const joinTableSchemas =
      joinTables.length > 0 ? this.effectGen.generateJoinTableSchemas(joinTables) : '';

    // Generate native Kysely table interfaces and the DB map.
    const dbInterface = this.kyselyGen.generateDBInterface(models, joinTables);

    // Assemble content with proper spacing
    // Order: imports/toolkit → branded IDs → model codecs → join codecs → tables → DB.
    let content = `${header}`;
    if (allBrandedIdSchemas) {
      content += `\n\n// ===== Branded ID Schemas =====\n${allBrandedIdSchemas}`;
    }
    content += `\n\n// ===== Model Schemas =====\n${modelSchemas}`;
    if (joinTableSchemas) {
      content += `\n\n${joinTableSchemas}`;
    }
    content += `\n\n${dbInterface}`;

    await this.fileManager.writeFile('types.ts', content);
  }

  /**
   * Generate index.ts file
   */
  private async generateIndex() {
    const content = this.kyselyGen.generateIndexFile();
    await this.fileManager.writeFile('index.ts', content);
  }
}
