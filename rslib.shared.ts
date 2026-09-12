import { pluginLess } from '@rsbuild/plugin-less';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';
import { pluginSvgr } from '@rsbuild/plugin-svgr';
import { defineConfig, type RsbuildPlugin } from '@rslib/core';
import { fileURLToPath } from 'node:url';

import { staticCjsChunksPlugin } from './scripts/build/static-cjs-chunks.ts';

interface PackageOptions {
  entry: Record<string, string>;
  react?: boolean;
  jsxImportSource?: string;
}

function browserStylesPlugin(entries: string[], format: 'esm' | 'cjs'): RsbuildPlugin {
  return {
    name: `fluxdown:browser-styles-${format}`,
    setup(api) {
      api.processAssets({ stage: 'additional' }, ({ compilation, sources }) => {
        // Keep the original modules shared by browser and Node entry points.
        // Only browser wrappers import CSS; Node can load the library for SSR.
        const extension = format === 'esm' ? 'js' : 'cjs';

        for (const entry of entries) {
          const original = `./${entry}.${extension}`;

          const source =
            format === 'esm'
              ? `import './styles.css';\nexport * from '${original}';\n`
              : `require('./styles.css');\nmodule.exports = require('${original}');\n`;

          compilation.emitAsset(`${entry}.browser.${extension}`, new sources.RawSource(source));
        }
      });
    },
  };
}

export function packageConfig({ entry, react, jsxImportSource }: PackageOptions) {
  return defineConfig({
    source: { entry, tsconfigPath: './tsconfig.build.json' },
    lib: [
      {
        format: 'esm',
        // Preserve shared declaration modules: bundling each entry duplicates
        // functive's unique-symbol brands and makes its JSX types incompatible.
        dts: { autoExtension: true },
        output: { distPath: './dist/esm' },
        plugins: react ? [browserStylesPlugin(Object.keys(entry), 'esm')] : [],
      },
      {
        format: 'cjs',
        dts: { autoExtension: true },
        output: { distPath: './dist/cjs' },
        plugins: [
          staticCjsChunksPlugin(),
          ...(react ? [browserStylesPlugin(Object.keys(entry), 'cjs')] : []),
        ],
        ...(Object.keys(entry).length > 1
          ? {
              tools: {
                rspack: {
                  optimization: {
                    // Entry points must share Symbols, classes and React contexts.
                    runtimeChunk: { name: 'rslib-runtime' },
                    splitChunks: {
                      cacheGroups: {
                        shared: {
                          name: 'shared',
                          test: /[\\/]src[\\/].*\.[cm]?[jt]sx?$/,
                          chunks: 'all',
                          minChunks: 2,
                          minSize: 0,
                          enforce: true,
                        },
                      },
                    },
                  },
                },
              },
            }
          : {}),
      },
    ],
    syntax: 'es2022',
    output: { target: react ? 'web' : 'node' },
    plugins: [
      ...(react || jsxImportSource
        ? [pluginReact({ swcReactOptions: { importSource: jsxImportSource, development: false } })]
        : []),
      ...(react ? [pluginSass(), pluginLess(), pluginSvgr()] : []),
    ],
    ...(react
      ? {
          resolve: {
            alias: {
              '@prefix': fileURLToPath(
                new URL('./packages/react-presets/src/styles/_prefix.scss', import.meta.url),
              ),
            },
          },
        }
      : {}),
    tools: {
      // Rslib does not infer this TypeScript option for SWC. Assignment breaks
      // fields such as `static name` and inherited accessor properties.
      swc: { jsc: { transform: { useDefineForClassFields: true } } },
      ...(react
        ? {
            // Browser wrappers statically import all styles, including lazy
            // components. The shared JavaScript must also load in bare Node.
            cssExtract: { pluginOptions: { runtime: false } },
            rspack: {
              optimization: {
                splitChunks: {
                  cacheGroups: {
                    styles: {
                      name: 'styles',
                      type: 'css/mini-extract',
                      chunks: 'all',
                      enforce: true,
                    },
                  },
                },
              },
            },
          }
        : {}),
    },
  });
}
