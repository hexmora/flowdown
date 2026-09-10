import type { IPluggableConfig } from '@flowdown/types';

import { BaseSlotPlugin } from '../../base';
import { ParagraphRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-paragraph'?: IPluggableConfig<void>;
  }
}

export class ParagraphSlotPlugin extends BaseSlotPlugin<'Paragraph'> {
  static readonly key = 'slot-paragraph';

  readonly Component = ParagraphRenderer;

  readonly type = 'Paragraph';
}
