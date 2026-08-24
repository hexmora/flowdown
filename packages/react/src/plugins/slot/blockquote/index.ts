import { BaseSlotPlugin } from '../base';
import { BlockquoteRenderer } from './renderer';

export class BlockquoteSlotPlugin extends BaseSlotPlugin<'Blockquote'> {
  static readonly key = 'slot-blockquote';

  readonly Component = BlockquoteRenderer;

  readonly type = 'Blockquote';
}
