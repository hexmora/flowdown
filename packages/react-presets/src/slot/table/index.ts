import type { IPluggableConfig } from '@flowdown/types';

import { BaseSlotPlugin } from '../../base';
import { TableRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-table'?: IPluggableConfig<void>;
  }
}

export class TableSlotPlugin extends BaseSlotPlugin<'Table'> {
  static readonly key = 'slot-table';

  readonly Component = TableRenderer;

  readonly type = 'Table';
}
