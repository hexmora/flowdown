import type { StorybookConfig } from '@storybook/react-vite';

import { resolve } from 'node:path';
import { mergeConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: (viteConfig) => {
    return mergeConfig(viteConfig, {
      plugins: [svgr()],
      resolve: {
        alias: {
          '@prefix': resolve(import.meta.dirname, '../../react-presets/src/styles/_prefix.scss'),
        },
      },
      // Workspace packages use functive/jsx-runtime, which has no jsxDEV export.
      oxc: {
        jsx: {
          development: false,
        },
      },
      optimizeDeps: {
        rolldownOptions: {
          transform: {
            jsx: {
              development: false,
            },
          },
        },
      },
    });
  },
};

export default config;
