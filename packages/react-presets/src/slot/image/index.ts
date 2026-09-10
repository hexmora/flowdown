import type { IPluggableConfig } from '@flowdown/types';

import { BaseSlotPlugin } from '../../base';
import { ImageRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-image'?: IPluggableConfig<void>;
  }
}

export class ImageSlotPlugin extends BaseSlotPlugin<'Image'> {
  static readonly key = 'slot-image';

  readonly Component = ImageRenderer;

  readonly type = 'Image';
}
