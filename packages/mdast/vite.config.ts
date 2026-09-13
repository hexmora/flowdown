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
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FlowdownMdast',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['@flowdown/utils', 'lodash-es'],
      output: {
        globals: {
          '@flowdown/utils': 'FlowdownUtils',
          'lodash-es': '_',
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
});
