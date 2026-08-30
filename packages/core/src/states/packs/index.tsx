/** @jsxImportSource @flowdown/reactive */

import type { IRehypePlugin, IRemarkPlugin, IRepairPlugin } from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import { BaseStateClosure, S } from '@flowdown/reactive';

import type { IRenderPlugin } from '../../externals/base-render-plugin';
import type { CoreStateClosureParams } from './type';

import { PluginBuilderStateClosure, TextChunkerStateClosure } from '../base';
import { BlockCompilerStateClosure } from '../hast/block-compiler';
import {
  getRehypePluggables,
  getRemarkPluggables,
  getRepairPluggables,
  isKeyablesEqual,
  toRawPatches,
  toRenderPatches,
} from './utils';

export * from './type';
export * from './utils';

export class CoreStateClosure<R, C = {}> extends BaseStateClosure<
  R[],
  CoreStateClosureParams<R, C>
> {
  protected render() {
    const { Renderer, text, patches, config, renders, remarks, rehypes, repairs } = this.inputs;

    const remarkSources = remarks ?? [];

    const rehypeSources = rehypes ?? [];

    const repairSources = repairs ?? [];

    return (
      <Renderer
        patches={S([toRenderPatches<R>, patches, isKeyablesEqual])}
        plugins={
          <PluginBuilderStateClosure<IRenderPlugin<ElementContent, Parent, R, C>>
            plugins={renders}
          />
        }
        source={
          <BlockCompilerStateClosure
            sections={
              <TextChunkerStateClosure
                text={text}
                patches={S([toRawPatches<R>, patches, isKeyablesEqual])}
              />
            }
            config={config}
            getRemarks={(blockConfig) => (
              <PluginBuilderStateClosure<IRemarkPlugin>
                plugins={S([
                  getRemarkPluggables,
                  {
                    config: blockConfig,
                    extras: remarkSources,
                    repairs: (
                      <PluginBuilderStateClosure<IRepairPlugin>
                        plugins={S([getRepairPluggables, { config, extras: repairSources }])}
                      />
                    ),
                  },
                ])}
              />
            )}
            getRehypes={() => (
              <PluginBuilderStateClosure<IRehypePlugin>
                plugins={S([getRehypePluggables, { config, extras: rehypeSources }])}
              />
            )}
          />
        }
      />
    );
  }
}
