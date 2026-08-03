import type { Root } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';
import { mathFromMarkdown, mathToMarkdown } from 'mdast-util-math';
import { math } from 'micromark-extension-math';

import type { SyntaxMathRemarkPluginConfig, SyntaxMathRemarkPluginInnerConfig } from './type';

import { appendRemarkExtensions } from '../../utils';
import { BaseRemarkPlugin } from '../base';
import { transformMath } from './utils';

export type { PandocMathData, PandocMathMode } from '../../typings';

export type { SyntaxMathRemarkPluginConfig } from './type';

export class SyntaxMathRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-syntax-math';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Lowest,
  };

  private readonly innerConfig: SyntaxMathRemarkPluginInnerConfig;

  plugin: Plugin<[], Root, Root>;

  constructor(config: SyntaxMathRemarkPluginConfig = {}) {
    super();

    this.innerConfig = {
      repairEnding: config.repairEnding ?? false,
    };
    const { repairEnding } = this.innerConfig;
    this.plugin = function () {
      appendRemarkExtensions(this.data(), {
        micromark: math(),
        fromMarkdown: mathFromMarkdown(),
        toMarkdown: mathToMarkdown(),
      });

      return (tree, file) => {
        transformMath(tree, String(file), repairEnding);
      };
    };
  }
}
