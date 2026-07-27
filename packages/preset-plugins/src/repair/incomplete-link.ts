import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';
import type { PhrasingContent } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { last, max } from 'lodash-es';

import { BaseRepairPlugin } from './base';

export class IncompleteLinkRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-incomplete-link';

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

    const tail = last(node.children);

    if (!tail || tail.type !== 'text') {
      return;
    }

    const lineStart = (max([tail.value.lastIndexOf('\n'), tail.value.lastIndexOf('\r')]) ?? -1) + 1;
    let opener = -1;

    for (let offset = tail.value.length - 1; offset >= lineStart; offset -= 1) {
      if (
        tail.value.charAt(offset) !== '[' ||
        tail.value.charAt(offset - 1) === '!' ||
        tail.value.charAt(offset - 1) === '['
      ) {
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

      if (slashCount % 2 === 1) {
        continue;
      }

      opener = offset;
      break;
    }

    if (opener < 0 || tail.value.charAt(opener + 1) === '^') {
      return;
    }

    const suffix = tail.value.slice(opener + 1);
    const close = suffix.lastIndexOf(']');
    let label = suffix;

    if (close >= 0) {
      label = suffix.slice(0, close);
      const remainder = suffix.slice(close + 1);

      if (remainder.length > 0 && (!remainder.startsWith('(') || remainder.endsWith(')'))) {
        return;
      }
    }

    const prefix = tail.value.slice(0, opener);
    const replacement: PhrasingContent[] = [];

    if (prefix.length > 0) {
      if (label.length === 0) {
        replacement.push({ type: 'text', value: prefix });
      } else {
        tail.value = prefix;
        replacement.push(tail);
      }
    }

    if (label.length > 0) {
      replacement.push({
        type: 'link',
        url: '#',
        title: null,
        children: [{ type: 'text', value: label }],
      });
    }

    node.children.splice(node.children.length - 1, 1, ...replacement);
  };
}
