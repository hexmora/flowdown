import type { Root as MdastRoot } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@fluxdown/types';
import remarkBreaks from 'remark-breaks';

import { BaseRemarkPlugin } from '../base';

export class SyntaxSoftEndlineRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-syntax-soft-endline';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Low,
  };

  plugin: Plugin<[], MdastRoot, MdastRoot> = remarkBreaks;
}
