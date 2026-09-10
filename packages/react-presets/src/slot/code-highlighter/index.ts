import type { IPluggableConfig } from '@flowdown/types';

import { BaseSlotPlugin } from '../../base';
import { CodeHighlighterRenderer } from './renderer';

declare global {
  interface SlotConfigs {
    'slot-code-highlighter'?: IPluggableConfig<void>;
  }
}

export class CodeHighlighterSlotPlugin extends BaseSlotPlugin<'CodeHighlighter'> {
  static readonly key = 'slot-code-highlighter';

  readonly Component = CodeHighlighterRenderer;

  readonly type = 'CodeHighlighter';
}
