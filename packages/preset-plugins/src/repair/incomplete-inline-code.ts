import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';
import type { PhrasingContent } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { last, nth } from 'lodash-es';

import { BaseRepairPlugin } from './base';

export class IncompleteInlineCodeRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-incomplete-inline-code';

  readonly config: RepairPluginSystemConfig = {
    ending: true,
    priority: PluginPriority.Default,
  };

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

    const { children } = node;

    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      const child = nth(children, childIndex);

      if (!child || (child.type !== 'text' && child.type !== 'html')) {
        return;
      }

      if (child.type !== 'text') {
        continue;
      }

      for (let offset = child.value.length - 1; offset >= 0; offset -= 1) {
        if (child.value.charAt(offset) !== '`') {
          continue;
        }

        if (child.value.charAt(offset - 1) === '`' || child.value.charAt(offset + 1) === '`') {
          continue;
        }

        let slashCount = 0;

        for (
          let slashOffset = offset - 1;
          slashOffset >= 0 && child.value.charAt(slashOffset) === '\\';
          slashOffset -= 1
        ) {
          slashCount += 1;
        }

        if (slashCount % 2 === 1) {
          continue;
        }

        const prefix = child.value.slice(0, offset);
        const suffix = child.value.slice(offset + 1);
        const following = children
          .slice(childIndex + 1)
          .map((item) => ('value' in item && typeof item.value === 'string' ? item.value : ''))
          .join('');
        const value = suffix + following;
        const replacement: PhrasingContent[] = [];

        if (prefix.length > 0) {
          child.value = prefix;
          replacement.push(child);
        }

        if (value.length > 0) {
          replacement.push({ type: 'inlineCode', value });
        }

        children.splice(childIndex, children.length - childIndex, ...replacement);

        return;
      }
    }
  };
}
