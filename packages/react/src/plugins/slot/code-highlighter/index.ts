import { BaseSlotPlugin } from '../base';
import { CodeHighlighterRenderer } from './renderer';

export class CodeHighlighterSlotPlugin extends BaseSlotPlugin<'CodeHighlighter'> {
  static readonly key = 'slot-code-highlighter';

  readonly Component = CodeHighlighterRenderer;

  readonly type = 'CodeHighlighter';
}
