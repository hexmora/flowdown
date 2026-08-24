import { BaseSlotPlugin } from '../base';
import { ListRenderer } from './renderer';

export class ListSlotPlugin extends BaseSlotPlugin<'List'> {
  static readonly key = 'slot-list';

  readonly Component = ListRenderer;

  readonly type = 'List';
}
