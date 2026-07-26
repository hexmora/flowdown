/* eslint-disable @typescript-eslint/no-invalid-void-type */
import type { IBasePluginConfig, IRemarkPlugin } from '@flowdown/types';
import type { Plugin } from 'unified';
import type { Node } from 'unist';

import { Destructible } from '@flowdown/utils';

import type { MdastRoot } from '../../typings';

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
