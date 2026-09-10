import type { IPluggableConfig } from '@flowdown/types';

import { BaseSlotPlugin } from '../../base';
import { EmphasisRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-emphasis'?: IPluggableConfig<void>;
  }
}

export class EmphasisSlotPlugin extends BaseSlotPlugin<'Emphasis'> {
  static readonly key = 'slot-emphasis';

  readonly Component = EmphasisRenderer;

  readonly type = 'Emphasis';
}
