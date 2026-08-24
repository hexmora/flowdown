import { BaseSlotPlugin } from '../base';
import { HeadingRenderer } from './renderer';

export class HeadingSlotPlugin extends BaseSlotPlugin<'Heading'> {
  static readonly key = 'slot-heading';

  readonly Component = HeadingRenderer;

  readonly type = 'Heading';
}
