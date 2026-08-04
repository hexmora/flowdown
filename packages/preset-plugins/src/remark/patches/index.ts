import type { Root } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';
import { cloneDeep } from 'lodash-es';

import type { PatchesRemarkPluginConfig } from './type';

import { BaseRemarkPlugin } from '../base';
import { applyPatches } from './utils';

export type { PatchesRemarkPluginConfig } from './type';
export type { ParserPatch, ParserPatchData, ParserPatchProperties } from '../../typings';

export class PatchesRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-patches';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Highest,
  };

  private readonly innerConfig: PatchesRemarkPluginConfig;

  plugin: Plugin<[], Root, Root>;

  constructor(config: PatchesRemarkPluginConfig = {}) {
    super();

    this.innerConfig = cloneDeep(config);
    this.plugin = () => (tree, file) => {
      if (!this.innerConfig.patches || this.innerConfig.patches.length === 0) {
        return;
      }

      const source = typeof file?.value === 'string' ? file.value : '';

      applyPatches(tree, this.innerConfig.patches, source);
    };
  }
}
