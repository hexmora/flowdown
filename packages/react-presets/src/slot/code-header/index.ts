import type { IPluggableConfig } from '@flowdown/types';

import { BaseSlotPlugin } from '../../base';
import { CodeHeaderRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-code-header'?: IPluggableConfig<void>;
  }
}

export class CodeHeaderSlotPlugin extends BaseSlotPlugin<'CodeHeader'> {
  static readonly key = 'slot-code-header';

  readonly Component = CodeHeaderRenderer;

  readonly type = 'CodeHeader';
}
