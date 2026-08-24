import { BaseSlotPlugin } from '../base';
import { EmphasisRenderer } from './renderer';

export class EmphasisSlotPlugin extends BaseSlotPlugin<'Emphasis'> {
  static readonly key = 'slot-emphasis';

  readonly Component = EmphasisRenderer;

  readonly type = 'Emphasis';
}
