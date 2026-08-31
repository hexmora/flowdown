import type { StorybookConfig } from '@storybook/react-vite';

import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  viteFinal: (viteConfig) => {
    return mergeConfig(viteConfig, {
      oxc: {
        jsx: {
          development: false,
        },
      },
    });
  },
};

export default config;
