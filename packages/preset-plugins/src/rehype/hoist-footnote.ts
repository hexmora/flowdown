import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';
import { isHastElement } from '@flowdown/utils';
import { has, last } from 'lodash-es';

import type { HastRoot } from '../typings';

import { BaseRehypePlugin } from './base';

export class HoistFootnoteRehypePlugin extends BaseRehypePlugin {
  static readonly key = 'rehype-hoist-footnote';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Lowest,
  };

  plugin: Plugin<[], HastRoot, HastRoot> = () => (tree) => {
    const lastChild = last(tree.children);

    if (!isHastElement(lastChild, 'section') || !has(lastChild.properties ?? {}, 'dataFootnotes')) {
      return;
    }

    const footnote = tree.children.pop();

    tree.data = { ...tree.data, footnote };
  };
}
