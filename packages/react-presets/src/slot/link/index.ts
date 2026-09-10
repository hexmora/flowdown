import type { IPluggableConfig } from '@flowdown/types';

import { BaseSlotPlugin } from '../../base';
import { LinkRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-link'?: IPluggableConfig<void>;
  }
}

export class LinkSlotPlugin extends BaseSlotPlugin<'Link'> {
  static readonly key = 'slot-link';

  readonly Component = LinkRenderer;

  readonly type = 'Link';
}
