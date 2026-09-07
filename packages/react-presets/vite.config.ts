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
      entry: {
        base: resolve(__dirname, 'src/base/index.ts'),
        render: resolve(__dirname, 'src/render/index.ts'),
        slot: resolve(__dirname, 'src/slot/index.ts'),
      },
      name: 'FlowdownReactPresets',
      cssFileName: 'flowdown-presets',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        '@flowdown/core',
        /^@flowdown\/core-presets(?:\/.*)?$/,
        /^reactive(?:\/.*)?$/,
        '@flowdown/types',
        '@flowdown/utils',
        'classnames',
        /^katex(?:\/.*)?$/,
        'lodash-es',
        /^mathjax-full(?:\/.*)?$/,
        'react',
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
