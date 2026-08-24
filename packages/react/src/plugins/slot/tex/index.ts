import { BaseSlotPlugin } from '../base';
import { TexRenderer } from './renderer';

export class TexSlotPlugin extends BaseSlotPlugin<'Tex'> {
  static readonly key = 'slot-tex';

  readonly Component = TexRenderer;

  readonly type = 'Tex';
}
