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
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'jsx-runtime': resolve(__dirname, 'src/jsx-runtime.ts'),
      },
      name: 'FlowdownReactive',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
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
