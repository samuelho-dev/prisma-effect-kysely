/**
 * Generator Configuration
 * Defines configuration options for prisma-effect-kysely generation,
 * with optional output grouping by Prisma namespace.
 */

import type { GeneratorOptions } from '@prisma/generator-helper';
import { Schema } from 'effect';

/**
 * Boolean string schema - strictly validates 'true' or 'false'
 */
const BooleanString = Schema.Literals(['true', 'false']);

/**
 * Generator configuration schema
 */
const GeneratorConfigSchema = Schema.Struct({
  /**
   * Output directory for generated Effect schemas
   */
  output: Schema.String,

  /**
   * Split generated output by Prisma namespace.
   */
  multiFileDomains: BooleanString,
});

/**
 * Generator configuration type derived from schema
 */
export type GeneratorConfig = Schema.Schema.Type<typeof GeneratorConfigSchema>;

/**
 * Parse and validate generator configuration from Prisma options
 */
export function parseGeneratorConfig(options: GeneratorOptions) {
  const { generator } = options;

  // Validate required output path
  const output = generator.output?.value;
  if (!output) {
    throw new Error(
      'Prisma Effect Generator: output path not configured.\n' +
        'Add "output" to your generator block in schema.prisma'
    );
  }

  const config = generator.config || {};
  const rawConfig = {
    output,
    multiFileDomains: getStringValue(config, 'multiFileDomains') ?? 'false',
  };

  // Validate with Effect Schema - throws on invalid input
  return Schema.decodeUnknownSync(GeneratorConfigSchema)(rawConfig);
}

/**
 * Extract string value from config
 */
function getStringValue(config: { [key: string]: string | string[] | undefined }, key: string) {
  const value = config[key];
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

/**
 * Check if multi-domain mode is enabled
 */
export function isMultiDomainEnabled(config: GeneratorConfig) {
  return config.multiFileDomains === 'true';
}
