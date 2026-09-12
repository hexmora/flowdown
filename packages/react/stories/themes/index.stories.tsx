import type { PluginConfigs } from '@fluxdown/core';
import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  SyntaxHtmlAllowedRemarkPlugin,
  SyntaxPolicyRemarkPlugin,
} from '@fluxdown/core-presets/remark';

import { Fluxdown } from '../../src';
import { THEME_MARKDOWN } from './consts';

const meta = {
  args: {
    build: { footnote: true, tex: true },
    plugins: [
      {
        config: {
          [SyntaxPolicyRemarkPlugin.key]: { indentedCode: true, setextHeading: true },
          [SyntaxHtmlAllowedRemarkPlugin.key]: {
            enabledTags: ['img', 'sub', 'sup', 'kbd', 'mark', 'details', 'summary'],
          },
        } satisfies PluginConfigs<
          typeof SyntaxHtmlAllowedRemarkPlugin | typeof SyntaxPolicyRemarkPlugin
        >,
        remarks: [SyntaxPolicyRemarkPlugin, SyntaxHtmlAllowedRemarkPlugin],
      },
    ],
    style: {
      boxSizing: 'border-box',
      minHeight: '100vh',
      padding: 'clamp(1.25rem, 5vw, 3rem) max(1.25rem, calc((100% - 48rem) / 2))',
    },
    text: THEME_MARKDOWN,
  },
  component: Fluxdown,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Themes',
} satisfies Meta<typeof Fluxdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: { theme: 'light' },
};

export const Dark: Story = {
  args: { theme: 'dark' },
};

export const Custom: Story = {
  args: {
    theme: {
      tokens: {
        colors: {
          accent: '#0f766e',
          accentHover: '#115e59',
          bg: '#fffdf7',
          border: '#e7e1d4',
          borderEmphasis: '#b0beb4',
          surfaceMuted: '#efeee5',
          surfaceSubtle: '#f6f5ed',
        },
        heading: {
          h1: { fontSize: '2.5rem', fontWeight: 600, lineHeight: 1.2 },
        },
        typography: {
          fontSans: "Georgia, 'Times New Roman', serif",
          lineHeight: { md: 1.8 },
        },
      },
    },
  },
};

export const DarkCustom: Story = {
  args: {
    theme: [
      'dark',
      {
        tokens: {
          colors: { accent: '#c4b5fd', accentHover: '#ddd6fe' },
          heading: { h1: { fontSize: '2.5rem' } },
          radius: { lg: '1.25rem' },
          syntax: { keyword: '#c4b5fd', function: '#f0abfc' },
        },
      },
    ],
  },
};
