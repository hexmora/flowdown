import type { IRepairPlugin } from '@fluxdown/types';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@fluxdown/types';

import { processRepairByPlugins } from '../../utils';
import { BaseRemarkPlugin } from '../base';

export interface ApplyRepairsRemarkPluginConfig {
  plugins: IRepairPlugin[];
  ending?: boolean;
  safe?: boolean;
}

type ApplyRepairsRemarkPluginInnerConfig = Required<ApplyRepairsRemarkPluginConfig>;

export class ApplyRepairsRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-apply-repairs';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.High,
  };

  private readonly innerConfig: ApplyRepairsRemarkPluginInnerConfig;

  plugin: Plugin<[], Root, Root>;

  constructor(config: ApplyRepairsRemarkPluginConfig = { plugins: [] }) {
    super();

    this.innerConfig = {
      plugins: [...config.plugins],
      ending: config.ending ?? false,
      safe: config.safe ?? true,
    };
    this.plugin = () => (tree) => {
      processRepairByPlugins({
        node: tree,
        plugins: this.innerConfig.plugins,
        ending: this.innerConfig.ending,
        safe: this.innerConfig.safe,
      });
    };
  }
}
