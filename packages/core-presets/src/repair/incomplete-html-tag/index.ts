import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';

import { PluginPriority } from '@flowdown/types';
import { isMdastParent } from '@flowdown/utils';

import { BaseRepairPlugin } from '../base';
import { getIncompleteTagStart } from './utils';

export class IncompleteHtmlTagRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-incomplete-html-tag';

  readonly config: RepairPluginSystemConfig = {
    ending: false,
    priority: PluginPriority.Default,
    rightFirst: true,
  };

  runner: RepairPluginRunner = ({ node, parent, insertNext, break: stop }) => {
    if (isMdastParent(node)) {
      if (node.children.length === 0) {
        stop();
      }

      return;
    }

    stop();

    if (node.type !== 'text' && node.type !== 'html') {
      return;
    }

    const start = getIncompleteTagStart(node.value);

    if (start === undefined) {
      return;
    }

    if (start === 0 && parent) {
      insertNext([], true);

      return;
    }

    node.value = node.value.slice(0, start);
  };
}
