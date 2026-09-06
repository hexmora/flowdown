import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';
import svgr from 'vite-plugin-svgr';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    libInjectCss(),
    dts({
      entryRoot: 'src',
      tsconfigPath: './tsconfig.build.json',
    }),
  ],
  resolve: {
    alias: {
      '@prefix': resolve(__dirname, 'src/styles/_prefix.scss'),
    },
  },
  oxc: {
    jsx: {
      development: false,
    },
  },
  build: {
    cssCodeSplit: true,
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'FlowdownReact',
      cssFileName: 'flowdown',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: [
        '@flowdown/core',
        /^reactive(?:\/.*)?$/,
        '@flowdown/types',
        '@flowdown/utils',
        'classnames',
        /^katex(?:\/.*)?$/,
        'lodash-es',
        /^mathjax-full(?:\/.*)?$/,
        'react',
        'react-dom',
        'react-error-boundary',
        'react/jsx-runtime',
        'shallow-equal',
        /^shiki(?:\/.*)?$/,
      ],
      output: {
        globals: {
          '@flowdown/core': 'FlowdownCore',
          reactive: 'FlowdownReactive',
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
    css: { include: [/prefix\.module\.scss$/] },
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
});
