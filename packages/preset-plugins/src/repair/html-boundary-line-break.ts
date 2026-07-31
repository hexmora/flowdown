import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';
import type { Html } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { nth } from 'lodash-es';

import { BaseRepairPlugin } from './base';

export class HtmlBoundaryLineBreakRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-html-boundary-line-break';

  private static readonly trailingLineEnding = /(?:\r\n|\n|\r)$/;

  readonly config: RepairPluginSystemConfig = {
    ending: false,
    priority: PluginPriority.Default,
  };

  runner: RepairPluginRunner = ({ node, parent, index }) => {
    if (node.type !== 'html' || !parent || index === undefined || index === 0) {
      return;
    }

    const previous = nth(parent.children, index - 1);

    if (
      previous?.type !== 'text' ||
      !HtmlBoundaryLineBreakRepairPlugin.trailingLineEnding.test(previous.value)
    ) {
      return;
    }

    const value = previous.value.replace(HtmlBoundaryLineBreakRepairPlugin.trailingLineEnding, '');
    const lineBreak: Html = { type: 'html', value: '<br />' };

    if (value.length === 0) {
      parent.children.splice(index - 1, 1, lineBreak);

      return;
    }

    previous.value = value;
    parent.children.splice(index, 0, lineBreak);
  };
}
