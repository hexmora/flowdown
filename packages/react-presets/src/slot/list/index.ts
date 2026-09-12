import type { IPluggableConfig } from '@fluxdown/types';

import { BaseSlotPlugin } from '../../base';
import { ListRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-list'?: IPluggableConfig<void>;
  }
}

export class ListSlotPlugin extends BaseSlotPlugin<'List'> {
  static readonly key = 'slot-list';

  readonly Component = ListRenderer;

  readonly type = 'List';
}
