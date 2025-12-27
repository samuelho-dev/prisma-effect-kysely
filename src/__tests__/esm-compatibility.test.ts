import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ESM Compatibility Tests
 *
 * These tests ensure the package maintains ESM compatibility,
 * particularly around importing CJS modules like @prisma/generator-helper.
 *
 * Node.js ESM cannot use named imports from CJS modules:
 *   ❌ import { generatorHandler } from '@prisma/generator-helper';
 *   ✅ import pkg from '@prisma/generator-helper'; const { generatorHandler } = pkg;
 *
 * @see https://nodejs.org/api/esm.html#interoperability-with-commonjs
 */
describe('ESM Compatibility', () => {
  const generatorIndexPath = join(import.meta.dirname, '../generator/index.ts');

  describe('@prisma/generator-helper imports', () => {
    it('should NOT use named imports from @prisma/generator-helper (CJS module)', () => {
      const content = readFileSync(generatorIndexPath, 'utf-8');

      // This pattern would fail at runtime in ESM:
      // import { generatorHandler } from '@prisma/generator-helper';
      const namedImportPattern = /import\s*\{[^}]*\}\s*from\s*['"]@prisma\/generator-helper['"]/;

      expect(content).not.toMatch(namedImportPattern);
    });

    it('should use default import pattern for @prisma/generator-helper', () => {
      const content = readFileSync(generatorIndexPath, 'utf-8');

      // Correct pattern: import pkg from '@prisma/generator-helper';
      const defaultImportPattern = /import\s+\w+\s+from\s*['"]@prisma\/generator-helper['"]/;

      expect(content).toMatch(defaultImportPattern);
    });

    it('should destructure generatorHandler from the default import', () => {
      const content = readFileSync(generatorIndexPath, 'utf-8');

      // Should have: const { generatorHandler } = pkg;
      // (where pkg is whatever the default import is named)
      const destructurePattern = /const\s*\{\s*generatorHandler\s*\}\s*=\s*\w+/;

      expect(content).toMatch(destructurePattern);
    });
  });

  describe('Type-only imports are allowed', () => {
    it('should allow type imports from @prisma/generator-helper (erased at compile time)', () => {
      // Type-only imports are safe because they're erased during compilation
      // This test documents that pattern is acceptable:
      // import type { DMMF, GeneratorOptions } from '@prisma/generator-helper';

      const orchestratorPath = join(import.meta.dirname, '../generator/orchestrator.ts');
      const content = readFileSync(orchestratorPath, 'utf-8');

      // Type imports should use 'import type' syntax
      const typeImportPattern =
        /import\s+type\s*\{[^}]*\}\s*from\s*['"]@prisma\/generator-helper['"]/;

      expect(content).toMatch(typeImportPattern);
    });
  });

  describe('Package ESM configuration', () => {
    it('should have type: module in package.json', () => {
      const packageJsonPath = join(import.meta.dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.type).toBe('module');
    });

    it('should use ESNext module in tsconfig', () => {
      const tsconfigPath = join(import.meta.dirname, '../../tsconfig.json');
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

      expect(tsconfig.compilerOptions.module).toBe('ESNext');
    });
  });
});
