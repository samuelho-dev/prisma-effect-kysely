#!/usr/bin/env node

import { parseArgs } from 'node:util';
const usage =
  'Usage: prisma-effect-kysely contract --contract <contract.json> --schema <contract.prisma> --output <directory>';

const command = process.argv[2];
const help = command === '--help' || command === '-h';

if (help) {
  console.log(usage);
} else if (command === 'contract') {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      contract: { type: 'string' },
      schema: { type: 'string' },
      output: { type: 'string' },
    },
    strict: true,
  });

  if (!(values.contract && values.schema && values.output)) {
    throw new Error(usage);
  }

  const { generateFromContract } = await import('./contract/generator.js');
  await generateFromContract({
    contractPath: values.contract,
    schemaPath: values.schema,
    outputPath: values.output,
  });
} else {
  throw new Error(usage);
}
