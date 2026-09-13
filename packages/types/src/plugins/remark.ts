import type { Root as MdastRoot } from 'mdast';
import type { IDestructible } from 'reactive';
import type { Plugin } from 'unified';
import type { Node } from 'unist';

import type { IPluginWithConfig } from './base';

export interface IRemarkPlugin<
  P = void,
  Input extends string | Node | undefined = MdastRoot,
  Output = Input,
>
  extends IPluginWithConfig, IDestructible {
  plugin: Plugin<P extends void ? [] : [P], Input, Output>;
}
