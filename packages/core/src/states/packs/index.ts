import type { IPluggable, IRehypePlugin, IRemarkPlugin, IRepairPlugin } from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import { BaseStateClosure, D, S } from '@flowdown/reactive';
import { isEqual } from 'lodash-es';

import type { IRenderPlugin } from '../../modules';
import type { BlockCompilerConfig, BlockRemarksConfig } from '../hast/block-compiler';
import type { CoreStateClosureParams } from './type';

import { PluginBuilderStateClosure, TextChunkerStateClosure } from '../base';
import { BlockCompilerStateClosure, SmoothStateClosure } from '../hast';
import {
  getRehypePluggables,
  getRemarkPluggables,
  getRepairPluggables,
  isKeyablesEqual,
  toBaseSmoothConfig,
  toRawPatches,
  toRenderPatches,
} from './utils';

export * from './consts';
export * from './type';
export * from './utils';

export class CoreStateClosure<R, C = {}> extends BaseStateClosure<
  R[],
  CoreStateClosureParams<R, C>
> {
  protected render() {
    const {
      Renderer,
      text,
      smooth: _smooth = false,
      patches,
      build,
      renders,
      remarks,
      rehypes,
      repairs,
    } = this.inputs;

    const remarkExtras = remarks ?? D<IPluggable<IRemarkPlugin, unknown>[]>([]);

    const rehypeExtras = rehypes ?? D<IPluggable<IRehypePlugin, unknown>[]>([]);

    const repairExtras = repairs ?? D<IPluggable<IRepairPlugin, unknown>[]>([]);

    const rawPatches = this.map(patches, toRawPatches, isKeyablesEqual);

    const renderPatches = this.map(patches, toRenderPatches, isKeyablesEqual);

    const smooth = this.map(_smooth, toBaseSmoothConfig, isEqual);

    const sections = S([
      TextChunkerStateClosure,
      {
        text,
        patches: rawPatches,
      },
    ]);

    const blocks = S([
      BlockCompilerStateClosure,
      {
        sections,
        config: build,
        getRemarks: (config) => {
          const repairPluggables = S([
            ({
              config: currentConfig,
              extras,
            }: {
              config: BlockCompilerConfig;
              extras: IPluggable<IRepairPlugin, unknown>[];
            }) => {
              return getRepairPluggables({ config: currentConfig, extras });
            },
            {
              config,
              extras: repairExtras,
            },
          ]);

          const repairPlugins = S([
            PluginBuilderStateClosure<IRepairPlugin>,
            { plugins: repairPluggables },
          ]);

          const remarkPluggables = S([
            ({
              config: currentConfig,
              extras,
              repairs: currentRepairs,
            }: {
              config: BlockRemarksConfig;
              extras: IPluggable<IRemarkPlugin, unknown>[];
              repairs: IRepairPlugin[];
            }) => {
              return getRemarkPluggables({
                config: currentConfig,
                extras,
                repairs: currentRepairs,
              });
            },
            {
              config,
              extras: remarkExtras,
              repairs: repairPlugins,
            },
          ]);

          return S([PluginBuilderStateClosure<IRemarkPlugin>, { plugins: remarkPluggables }]);
        },
        getRehypes: () => {
          const pluggables = S([
            ({
              config,
              extras,
            }: {
              config: BlockCompilerConfig;
              extras: IPluggable<IRehypePlugin, unknown>[];
            }) => {
              return getRehypePluggables({ config, extras });
            },
            {
              config: build,
              extras: rehypeExtras,
            },
          ]);

          return S([PluginBuilderStateClosure<IRehypePlugin>, { plugins: pluggables }]);
        },
      },
    ]);

    const smoothBlocks = S([
      SmoothStateClosure,
      {
        source: blocks,
        enabled: this.map(smooth, ({ enabled }) => enabled),
        ticker: this.map(smooth, ({ ticker }) => ticker),
        scheduler: this.map(smooth, ({ scheduler }) => scheduler),
      },
    ]);

    const renderPlugins = S([
      PluginBuilderStateClosure<IRenderPlugin<ElementContent, Parent, R, C>>,
      { plugins: renders },
    ]);

    return S([
      Renderer,
      {
        source: smoothBlocks,
        patches: renderPatches,
        plugins: renderPlugins,
      },
    ]);
  }
}
