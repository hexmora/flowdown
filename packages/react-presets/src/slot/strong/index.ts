import type { IPluggableConfig } from '@fluxdown/types';

import { BaseSlotPlugin } from '../../base';
import { StrongRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-strong'?: IPluggableConfig<void>;
  }
}

export class StrongSlotPlugin extends BaseSlotPlugin<'Strong'> {
  static readonly key = 'slot-strong';

  readonly Component = StrongRenderer;

  readonly type = 'Strong';
}
