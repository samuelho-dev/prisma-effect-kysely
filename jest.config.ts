import type { Config } from 'jest';
import { createDefaultEsmPreset } from 'ts-jest';

const presetConfig = createDefaultEsmPreset({
  tsconfig: '<rootDir>/tsconfig.spec.json',
});

export default {
  ...presetConfig,
  displayName: 'prisma-effect-kysely-generator',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: './coverage',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**/*',
    '!src/test-output*/**/*',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
