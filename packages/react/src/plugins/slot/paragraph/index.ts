import { BaseSlotPlugin } from '../base';
import { ParagraphRenderer } from './renderer';

export class ParagraphSlotPlugin extends BaseSlotPlugin<'Paragraph'> {
  static readonly key = 'slot-paragraph';

  readonly Component = ParagraphRenderer;

  readonly type = 'Paragraph';
}
