import type { IPluggableConfig } from '@flowdown/types';

import { BaseSlotPlugin } from '../../base';
import { TexRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-tex'?: IPluggableConfig<void>;
  }
}

export class TexSlotPlugin extends BaseSlotPlugin<'Tex'> {
  static readonly key = 'slot-tex';

  readonly Component = TexRenderer;

  readonly type = 'Tex';
}
