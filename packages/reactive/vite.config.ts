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
      name: 'FlowdownReactive',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['lodash-es', /^rxjs(?:\/.*)?$/, 'shallow-equal'],
      output: {
        globals: {
          'lodash-es': '_',
          rxjs: 'rxjs',
          'shallow-equal': 'shallowEqual',
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
});
