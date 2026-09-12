import type { RsbuildPlugin, Rspack } from '@rslib/core';

import { posix } from 'node:path';

/** Keep CJS chunk imports statically discoverable by downstream browser bundlers. */
export function staticCjsChunksPlugin(): RsbuildPlugin {
  const name = 'fluxdown:static-cjs-chunks';

  return {
    name,
    setup(api) {
      api.modifyRspackConfig((config, { rspack }) => {
        config.plugins ??= [];

        config.plugins.push({
          apply(compiler: Rspack.Compiler) {
            compiler.hooks.compilation.tap(name, (compilation) => {
              const requiredAssets = new Set<string>();

              const filename = (chunk: Rspack.Chunk) =>
                compilation.getPath(
                  rspack.javascript.JavascriptModulesPlugin.getChunkFilenameTemplate(
                    chunk,
                    compilation.outputOptions,
                  )!,
                  { chunk, contentHashType: 'javascript' },
                );

              compilation.hooks.runtimeModule.tap(name, (module, runtimeChunk) => {
                if (module.name !== 'require_chunk_loading') return;

                const source = module.source;

                if (!source) throw new Error('The CJS chunk loader has no generated source.');

                const original = source.source.toString();

                // This hook changes only Rspack's generated loading expression,
                // preserving its module cache, chunk installation and startup.
                // Fail on runtime changes when upgrading Rspack instead of
                // silently publishing a dynamic require context again.
                const dynamicRequire = /require\("\.\/" \+ __webpack_require__\.u\(chunkId\)\)/g;

                if ([...original.matchAll(dynamicRequire)].length !== 1) {
                  throw new Error(
                    'Unexpected Rspack CJS chunk loader; review static chunk imports.',
                  );
                }

                const runtimeDirectory = posix.dirname(filename(runtimeChunk));

                const loaders: string[] = [];

                for (const chunk of runtimeChunk.getAllReferencedChunks()) {
                  if (
                    chunk.hasRuntime() ||
                    compilation.chunkGraph.getNumberOfEntryModules(chunk) > 0 ||
                    compilation.chunkGraph.getChunkModulesIterableBySourceType(chunk, 'javascript')
                      .length === 0
                  ) {
                    continue;
                  }

                  const file = filename(chunk);

                  requiredAssets.add(file);

                  const request = `./${posix.relative(runtimeDirectory, file)}`;

                  loaders.push(
                    `${JSON.stringify(chunk.id)}: () => require(${JSON.stringify(request)})`,
                  );
                }

                source.source = Buffer.from(
                  `var fluxdownChunkLoaders = {${loaders.join(',')}};\n` +
                    original.replace(dynamicRequire, 'fluxdownChunkLoaders[chunkId]()'),
                );
              });

              compilation.hooks.processAssets.tap(
                { name, stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS },
                () => {
                  for (const file of requiredAssets) {
                    if (!file.endsWith('.cjs') || !compilation.getAsset(file)) {
                      throw new Error(
                        `The CJS chunk loader references a missing JavaScript asset: ${file}`,
                      );
                    }
                  }
                },
              );
            });
          },
        });
      });
    },
  };
}
