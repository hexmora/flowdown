import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';
import type { PhrasingContent } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { last } from 'lodash-es';

import { BaseRepairPlugin } from './base';

export type IncompleteImageRepairPluginConfig = {
  strategy?: 'discard' | 'placeholder';
};

type IncompleteImageRepairPluginInnerConfig = Required<IncompleteImageRepairPluginConfig>;

export class IncompleteImageRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-incomplete-image';

  readonly config: RepairPluginSystemConfig = {
    ending: true,
    priority: PluginPriority.Default,
  };

  private readonly innerConfig: IncompleteImageRepairPluginInnerConfig;

  runner: RepairPluginRunner = ({ node, parents }) => {
    if (node.type !== 'paragraph') {
      return;
    }

    let branch = node;

    for (const parent of parents) {
      if (last(parent.children) !== branch) {
        return;
      }

      branch = parent;
    }

    const tail = last(node.children);

    if (!tail || tail.type !== 'text') {
      return;
    }

    let opener = -1;

    for (let offset = tail.value.length - 2; offset >= 0; offset -= 1) {
      if (tail.value.charAt(offset) !== '!' || tail.value.charAt(offset + 1) !== '[') {
        continue;
      }

      let slashCount = 0;

      for (
        let slashOffset = offset - 1;
        slashOffset >= 0 && tail.value.charAt(slashOffset) === '\\';
        slashOffset -= 1
      ) {
        slashCount += 1;
      }

      if (slashCount % 2 === 0) {
        opener = offset;
        break;
      }
    }

    if (opener < 0) {
      return;
    }

    const suffix = tail.value.slice(opener + 2);
    const close = suffix.indexOf(']');
    let alt = suffix;

    if (close >= 0) {
      alt = suffix.slice(0, close);
      const remainder = suffix.slice(close + 1);

      if (remainder.length > 0 && (!remainder.startsWith('(') || remainder.endsWith(')'))) {
        return;
      }
    }

    const prefix = tail.value.slice(0, opener);
    const replacement: PhrasingContent[] = [];

    if (prefix.length > 0) {
      if (this.innerConfig.strategy === 'discard') {
        replacement.push({ type: 'text', value: prefix });
      } else {
        tail.value = prefix;
        replacement.push(tail);
      }
    }

    if (this.innerConfig.strategy === 'placeholder') {
      replacement.push({
        type: 'image',
        url: '',
        alt: alt.length > 0 ? alt : 'image',
      });
    }

    node.children.splice(node.children.length - 1, 1, ...replacement);
  };

  constructor(config: IncompleteImageRepairPluginConfig = {}) {
    super();

    this.innerConfig = {
      strategy: config.strategy ?? 'placeholder',
    };
  }
}
