import type { Extension } from 'micromark-util-types';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';

import type { MdastRoot } from '../typings';

import { appendMicromarkExtension } from '../utils';
import { BaseRemarkPlugin } from './base';

export interface SyntaxPolicyRemarkPluginConfig {
  indentedCode?: boolean;

  setextHeading?: boolean;
}

type SyntaxPolicyRemarkPluginInnerConfig = Required<SyntaxPolicyRemarkPluginConfig>;

export class SyntaxPolicyRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-syntax-policy';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Default,
  };

  private readonly innerConfig: SyntaxPolicyRemarkPluginInnerConfig;

  plugin: Plugin<[], MdastRoot, MdastRoot>;

  constructor(config: SyntaxPolicyRemarkPluginConfig = {}) {
    super();

    this.innerConfig = {
      indentedCode: config.indentedCode ?? false,
      setextHeading: config.setextHeading ?? false,
    };
    const { indentedCode, setextHeading } = this.innerConfig;
    const disabledConstructs: string[] = [];

    if (!indentedCode) {
      disabledConstructs.push('codeIndented');
    }

    if (!setextHeading) {
      disabledConstructs.push('setextUnderline');
    }

    this.plugin = function () {
      const extension: Extension = {
        disable: {
          null: [...disabledConstructs],
        },
      };

      appendMicromarkExtension(this.data(), extension);
    };
  }
}
