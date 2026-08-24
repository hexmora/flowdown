import { BaseSlotPlugin } from '../base';
import { StrongRenderer } from './renderer';

export class StrongSlotPlugin extends BaseSlotPlugin<'Strong'> {
  static readonly key = 'slot-strong';

  readonly Component = StrongRenderer;

  readonly type = 'Strong';
}
