import { BaseSlotPlugin } from '../base';
import { TableRenderer } from './renderer';

export class TableSlotPlugin extends BaseSlotPlugin<'Table'> {
  static readonly key = 'slot-table';

  readonly Component = TableRenderer;

  readonly type = 'Table';
}
