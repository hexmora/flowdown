import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
  build: {
    cssCodeSplit: true,
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'FlowdownReact',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: [
        '@flowdown/core',
        '@flowdown/reactive',
        '@flowdown/types',
        '@flowdown/utils',
        'lodash-es',
        'react',
        'react-dom',
        'react-error-boundary',
        'react/jsx-runtime',
        'shallow-equal',
      ],
      output: {
        globals: {
          '@flowdown/core': 'FlowdownCore',
          '@flowdown/reactive': 'FlowdownReactive',
          '@flowdown/types': 'FlowdownTypes',
          '@flowdown/utils': 'FlowdownUtils',
          'lodash-es': 'lodashEs',
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-error-boundary': 'ReactErrorBoundary',
          'react/jsx-runtime': 'jsxRuntime',
          'shallow-equal': 'shallowEqual',
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
});
