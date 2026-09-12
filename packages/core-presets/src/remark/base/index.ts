/* eslint-disable @typescript-eslint/no-invalid-void-type */
import type { IBasePluginConfig, IRemarkPlugin } from '@fluxdown/types';
import type { Root as MdastRoot } from 'mdast';
import type { Plugin } from 'unified';
import type { Node } from 'unist';

import { Destructible } from 'functive';

export abstract class BaseRemarkPlugin<
  P = void,
  I extends string | Node | undefined = MdastRoot,
  O = I,
>
  extends Destructible
  implements IRemarkPlugin<P, I, O>
{
  config: IBasePluginConfig = {};

  abstract plugin: Plugin<P extends void ? [] : [P], I, O>;
}
