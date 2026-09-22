import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { GeneratorOptions } from '@prisma/generator-helper';
import { GeneratorOrchestrator } from '../generator/orchestrator.js';
import { contractToDmmf } from './adapter.js';

export interface ContractGenerationOptions {
  readonly contractPath: string;
  readonly schemaPath: string;
  readonly outputPath: string;
  readonly multiDomain?: boolean;
}

/** Generate the package's normal output from a Prisma 8 contract artifact. */
export async function generateFromContract(options: ContractGenerationOptions) {
  const contractPath = resolve(options.contractPath);
  const schemaPath = resolve(options.schemaPath);
  const outputPath = resolve(options.outputPath);
  const [contractJson, schemaSource] = await Promise.all([
    readFile(contractPath, 'utf8'),
    readFile(schemaPath, 'utf8'),
  ]);
  const dmmf = contractToDmmf(contractJson, schemaSource);
  const generatorOptions: GeneratorOptions = {
    generator: {
      name: 'prisma-effect-kysely-contract',
      output: { value: outputPath, fromEnvVar: null },
      provider: { value: 'prisma-effect-kysely', fromEnvVar: null },
      config: {
        multiFileDomains: String(options.multiDomain ?? false),
      },
      binaryTargets: [],
      previewFeatures: [],
      sourceFilePath: schemaPath,
    },
    otherGenerators: [],
    schemaPath,
    dmmf,
    datasources: [],
    datamodel: schemaSource,
    version: '8-contract',
  };

  const orchestrator = new GeneratorOrchestrator(generatorOptions);
  await orchestrator.generate(generatorOptions);
}
