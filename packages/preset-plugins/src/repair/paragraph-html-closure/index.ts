import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';

import { PluginPriority } from '@flowdown/types';

import { isRepairNodeType } from '../../utils/repair-node';
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
