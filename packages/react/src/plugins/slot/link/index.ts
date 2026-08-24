import { BaseSlotPlugin } from '../base';
import { LinkRenderer } from './renderer';

export class LinkSlotPlugin extends BaseSlotPlugin<'Link'> {
  static readonly key = 'slot-link';

  readonly Component = LinkRenderer;

  readonly type = 'Link';
}
