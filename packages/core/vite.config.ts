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
  oxc: {
    jsx: {
      development: false,
    },
  },
  build: {
    cssCodeSplit: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        presets: resolve(__dirname, 'src/presets.ts'),
      },
      name: 'Flowdown',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['@flowdown/preset-plugins', /^reactive(?:\/.*)?$/],
    },
  },
  test: {
    environment: 'node',
  },
});
