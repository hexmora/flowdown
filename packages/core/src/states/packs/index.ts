import type { IRehypePlugin, IRemarkPlugin, IRepairPlugin } from '@flowdown/types';

import { BaseStateClosure, buildDescriptor, D, S } from '@flowdown/reactive';

import type { CoreStateClosureParams } from './type';

import { PluginBuilderStateClosure, TextChunkerStateClosure } from '../base';
import { BlockCompilerStateClosure } from '../hast/block-compiler';
import {
  getRehypeClasses,
  getRemarkClasses,
  getRemarkPluginConfigs,
  getRepairClasses,
  isKeyablesEqual,
  toRawPatches,
  toRenderPatches,
} from './utils';

export * from './type';
export * from './utils';

export class CoreStateClosure<R, C = {}> extends BaseStateClosure<R[]> {
  constructor({
    Renderer,
    text,
    patches,
    config,
    renders,
    pluginConfigs,
    remarks,
    rehypes,
    repairs,
  }: CoreStateClosureParams<R, C>) {
    const pluginConfigSource = pluginConfigs ?? {};

    const remarkSources = remarks ?? [];

    const rehypeSources = rehypes ?? [];

    const repairSources = repairs ?? [];

    super({
      source: () => {
        const renderer = this.clearable(
          buildDescriptor(
            S([
              Renderer,
              {
                patches: S([toRenderPatches<R>, patches, isKeyablesEqual]),
                plugins: renders,
                source: S([
                  BlockCompilerStateClosure,
                  {
                    sections: S([
                      TextChunkerStateClosure,
                      {
                        text,
                        patches: S([toRawPatches<R>, patches, isKeyablesEqual]),
                      },
                    ]),
                    config,
                    getRemarks: (blockConfig) =>
                      S([
                        PluginBuilderStateClosure<IRemarkPlugin>,
                        {
                          plugins: S([
                            getRemarkClasses,
                            { config: blockConfig, extras: remarkSources },
                          ]),
                          configs: S([
                            getRemarkPluginConfigs,
                            {
                              configs: pluginConfigSource,
                              blockConfig,
                              repairs: S([
                                PluginBuilderStateClosure<IRepairPlugin>,
                                {
                                  plugins: S([getRepairClasses, { config, extras: repairSources }]),
                                  configs: D(pluginConfigSource),
                                },
                              ]),
                            },
                          ]),
                        },
                      ]),
                    getRehypes: () =>
                      S([
                        PluginBuilderStateClosure<IRehypePlugin>,
                        {
                          plugins: S([getRehypeClasses, { config, extras: rehypeSources }]),
                          configs: D(pluginConfigSource),
                        },
                      ]),
                  },
                ]),
              },
            ]),
          ),
        );

        return renderer.value;
      },
    });
  }
}
