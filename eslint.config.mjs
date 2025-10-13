// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jestPlugin from 'eslint-plugin-jest';

export default tseslint.config(
  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript recommended rules (without type-checking)
  ...tseslint.configs.recommended,

  // Source files configuration
  {
    files: ['src/**/*.ts'],
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],

      // Best practices
      'no-console': 'off', // Generator needs console for logging
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // Test files configuration
  {
    files: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    ...jestPlugin.configs['flat/recommended'],
    rules: {
      ...jestPlugin.configs['flat/recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests for mocking
      '@typescript-eslint/no-unused-vars': 'off', // Allow unused vars in tests
      'jest/expect-expect': 'error',
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-conditional-expect': 'warn', // Downgrade to warning
      'jest/prefer-to-be': 'error',
      'jest/valid-expect': 'error',
    },
  },

  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '**/*.d.ts',
      'src/test-output*/**',
      'src/__tests__/generated/**',
      'jest.config.ts',
    ],
  }
);
