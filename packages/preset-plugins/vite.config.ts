import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
  build: {
    cssCodeSplit: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FlowdownPresetPlugins',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: [
        '@flowdown/types',
        '@flowdown/utils',
        'hast-util-sanitize',
        'lodash-es',
        'mdast-util-from-markdown',
        'mdast-util-gfm-autolink-literal',
        'mdast-util-gfm-footnote',
        'mdast-util-gfm-strikethrough',
        'mdast-util-gfm-table',
        'mdast-util-gfm-task-list-item',
        'mdast-util-math',
        'mdast-util-to-markdown',
        'micromark-extension-gfm-autolink-literal',
        'micromark-extension-gfm-footnote',
        'micromark-extension-gfm-strikethrough',
        'micromark-extension-gfm-table',
        'micromark-extension-gfm-task-list-item',
        'micromark-extension-math',
        'micromark-util-character',
        'micromark-util-types',
        'reactive',
        'rehype-raw',
        'rehype-sanitize',
        'remark-breaks',
        'unified',
      ],
    },
  },
  test: {
    environment: 'node',
  },
});
