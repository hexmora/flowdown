import type { IPluggableConfig } from '@flowdown/types';

import { BaseSlotPlugin } from '../../base';
import { CodeBlockRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-code-block'?: IPluggableConfig<void>;
  }
}

export class CodeBlockSlotPlugin extends BaseSlotPlugin<'CodeBlock'> {
  static readonly key = 'slot-code-block';

  readonly Component = CodeBlockRenderer;

  readonly type = 'CodeBlock';
}
