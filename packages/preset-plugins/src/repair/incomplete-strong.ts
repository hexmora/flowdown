import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';
import type { PhrasingContent } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first, last, nth } from 'lodash-es';

import { isRepairNodeType } from '../utils/repair-node';
import { BaseRepairPlugin } from './base';

export class IncompleteStrongRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-incomplete-strong';

  readonly config: RepairPluginSystemConfig = {
    ending: true,
    priority: PluginPriority.Default,
  };

  runner: RepairPluginRunner = ({ node, parent, parents, index }) => {
    let branch = node;

    for (const ancestor of parents) {
      if (last(ancestor.children) !== branch) {
        return;
      }

      branch = ancestor;
    }

    if (isRepairNodeType(node, 'list')) {
      const item = first(node.children);

      if (
        !node.ordered &&
        node.children.length === 1 &&
        item?.children.length === 0 &&
        parent &&
        index !== undefined
      ) {
        parent.children.splice(index, 1);
      }

      return;
    }

    if (node.type !== 'paragraph') {
      return;
    }

    const { children } = node;
    const tail = last(children);
    const beforeTail = nth(children, -2);

    if (
      tail?.type === 'emphasis' &&
      beforeTail?.type === 'text' &&
      beforeTail.value.endsWith('*')
    ) {
      let slashCount = 0;

      for (
        let slashOffset = beforeTail.value.length - 2;
        slashOffset >= 0 && beforeTail.value.charAt(slashOffset) === '\\';
        slashOffset -= 1
      ) {
        slashCount += 1;
      }

      if (slashCount % 2 === 0) {
        const prefix = beforeTail.value.slice(0, -1);
        const replacement: PhrasingContent[] = [];

        if (prefix.length > 0) {
          beforeTail.value = prefix;
          replacement.push(beforeTail);
        }

        replacement.push({ type: 'strong', children: tail.children });
        children.splice(children.length - 2, 2, ...replacement);
      }

      return;
    }

    if (!tail || tail.type !== 'text') {
      return;
    }

    for (let offset = tail.value.length - 2; offset >= 0; offset -= 1) {
      const marker = tail.value.slice(offset, offset + 2);

      if (marker !== '**' && marker !== '__') {
        continue;
      }

      if (
        tail.value.charAt(offset - 1) === marker.charAt(0) ||
        tail.value.charAt(offset + 2) === marker.charAt(0)
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

      const prefix = tail.value.slice(0, offset);
      const suffix = tail.value.slice(offset + 2);

      if (/^\s/.test(suffix)) {
        return;
      }

      if (
        marker === '__' &&
        /[A-Za-z]/.test(tail.value.charAt(offset - 1)) &&
        /[A-Za-z]/.test(tail.value.charAt(offset + 2))
      ) {
        return;
      }

      const replacement: PhrasingContent[] = [];

      if (prefix.length > 0) {
        tail.value = prefix;
        replacement.push(tail);
      }

      if (suffix.length > 0) {
        replacement.push({
          type: 'strong',
          children: [{ type: 'text', value: suffix }],
        });
      }

      children.splice(children.length - 1, 1, ...replacement);

      return;
    }
  };
}
