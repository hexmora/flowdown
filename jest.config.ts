import type { Options } from '@swc/core';
import type { Config } from 'jest';

import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

const swc = (importSource: string): [string, Options] => [
  '@swc/jest',
  {
    jsc: {
      target: 'es2022',
      parser: { syntax: 'typescript', tsx: true, decorators: true },
      transform: {
        legacyDecorator: true,
        react: { runtime: 'automatic', importSource, development: false },
      },
    },
    module: { type: 'commonjs' },
  },
];

const config: Config = {
  rootDir,
  projects: ['utils', 'functive', 'core-presets', 'core', 'react-presets', 'react'].map((name) => ({
    displayName: name,
    rootDir,
    // Release dry runs contain package copies; keep them outside Jest's module map.
    roots: ['<rootDir>/packages', '<rootDir>/scripts/testing'],
    modulePathIgnorePatterns: ['<rootDir>/packages/[^/]+/dist/'],
    testMatch: [`<rootDir>/packages/${name}/src/**/*.test.{ts,tsx}`],
    testEnvironment:
      name === 'react' || name === 'react-presets'
        ? '<rootDir>/scripts/testing/jsdom-environment.ts'
        : 'node',
    setupFilesAfterEnv:
      name === 'react' || name === 'react-presets'
        ? [`<rootDir>/packages/${name}/jest.setup.ts`]
        : [],
    moduleNameMapper: { '^(.+\\.svg)\\?react$': '$1' },
    transform: {
      // A project may import another package's sources, so select JSX by source path.
      '^.+/packages/(?:functive|core|core-presets)/.+\\.[jt]sx?$': swc('functive'),
      '^.+\\.[cm]?[jt]sx?$': swc('react'),
      '^.+\\.(?:css|scss|sass|less|svg)$': '<rootDir>/scripts/testing/assets-transformer.ts',
    },
    // Markdown and Shiki dependencies are ESM-only. SWC also transforms dependencies
    // so the CJS Jest runtime can execute them without experimental VM flags.
    transformIgnorePatterns: [],
  })),
};

export default config;
