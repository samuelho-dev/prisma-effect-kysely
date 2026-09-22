#!/usr/bin/env node

import { parseArgs } from 'node:util';

const command = process.argv[2];
const help = command === '--help' || command === '-h';

if (help) {
  console.log(
    'Usage: prisma-effect-kysely contract --contract <contract.json> --schema <contract.prisma> --output <directory>'
  );
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
    throw new Error(
      'Usage: prisma-effect-kysely contract --contract <contract.json> --schema <contract.prisma> --output <directory>'
    );
  }

  const { generateFromContract } = await import('./contract/generator.js');
  await generateFromContract({
    contractPath: values.contract,
    schemaPath: values.schema,
    outputPath: values.output,
  });
} else {
  await import('./generator/index.js');
}
