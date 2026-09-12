import type { IPluggableConfig } from '@fluxdown/types';

import { BaseSlotPlugin } from '../../base';
import { BlockquoteRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-blockquote'?: IPluggableConfig<void>;
  }
}

export class BlockquoteSlotPlugin extends BaseSlotPlugin<'Blockquote'> {
  static readonly key = 'slot-blockquote';

  readonly Component = BlockquoteRenderer;

  readonly type = 'Blockquote';
}
