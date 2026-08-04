import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';
import remarkBreaks from 'remark-breaks';

import type { MdastRoot } from '../typings';

import { BaseRemarkPlugin } from './base';

export class SyntaxSoftEndlineRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-syntax-soft-endline';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Low,
  };

  plugin: Plugin<[], MdastRoot, MdastRoot> = remarkBreaks;
}
