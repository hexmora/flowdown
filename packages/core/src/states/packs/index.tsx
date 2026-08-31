/** @jsxImportSource @flowdown/reactive */

import type {
  IPluggable,
  IRawPatchItem,
  IRehypePlugin,
  IRemarkPlugin,
  IRepairPlugin,
} from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import { BaseStateClosure, S } from '@flowdown/reactive';

import type { IRenderPlugin } from '../../externals/base-render-plugin';
import type { IRenderPatchItem } from '../../externals/base-renderer';
import type { CoreStateClosureParams } from './type';

import { PluginBuilderStateClosure, TextChunkerStateClosure } from '../base';
import { BlockCompilerStateClosure } from '../hast/block-compiler';
import {
  RawPatchesMapper,
  RehypePluggablesMapper,
  RemarkPluggablesMapper,
  RenderPatchesMapper,
  RepairPluggablesMapper,
} from './states';

export * from './states';
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
        patches={S<IRenderPatchItem<R>[]>(<RenderPatchesMapper<R> patches={patches} />)}
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
                patches={S<IRawPatchItem[]>(<RawPatchesMapper<R> patches={patches} />)}
              />
            }
            config={config}
            getRemarks={(blockConfig) => (
              <PluginBuilderStateClosure<IRemarkPlugin>
                plugins={S<IPluggable<IRemarkPlugin, unknown>[]>(
                  <RemarkPluggablesMapper
                    config={blockConfig}
                    extras={remarkSources}
                    repairs={
                      <PluginBuilderStateClosure<IRepairPlugin>
                        plugins={S<IPluggable<IRepairPlugin, unknown>[]>(
                          <RepairPluggablesMapper config={config} extras={repairSources} />,
                        )}
                      />
                    }
                  />,
                )}
              />
            )}
            getRehypes={() => (
              <PluginBuilderStateClosure<IRehypePlugin>
                plugins={S<IPluggable<IRehypePlugin, unknown>[]>(
                  <RehypePluggablesMapper config={config} extras={rehypeSources} />,
                )}
              />
            )}
          />
        }
      />
    );
  }
}
