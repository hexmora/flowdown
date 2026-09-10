import type { IPluggableConfig } from '@flowdown/types';

import { BaseSlotPlugin } from '../../base';
import { BreakLineRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-break-line'?: IPluggableConfig<void>;
  }
}

export class BreakLineSlotPlugin extends BaseSlotPlugin<'BreakLine'> {
  static readonly key = 'slot-break-line';

  readonly Component = BreakLineRenderer;

  readonly type = 'BreakLine';
}
