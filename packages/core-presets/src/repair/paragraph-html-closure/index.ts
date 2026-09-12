import type { RepairPluginRunner, RepairPluginSystemConfig } from '@fluxdown/types';

import { PluginPriority } from '@fluxdown/types';

import { isRepairNodeType } from '../../utils';
import { BaseRepairPlugin } from '../base';
import { closeParagraphTags, isRightmostNode } from './utils';

export class ParagraphHtmlClosureRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-paragraph-html-closure';

  readonly config: RepairPluginSystemConfig = {
    ending: false,
    priority: PluginPriority.Low,
  };

  runner: RepairPluginRunner = ({ node, parents, skipTree }) => {
    if (!isRepairNodeType(node, 'paragraph')) {
      return;
    }

    skipTree();

    if (isRightmostNode(node, parents)) {
      return;
    }

    closeParagraphTags(node);
  };
}
