import type { IBasePluginConfig } from '@flowdown/types';

import { Destructible } from 'reactive';

import { IRenderPlugin, IRenderPluginMatchParams, IRenderPluginRenderParams } from './type';

export * from './type';

export abstract class BaseRenderPlugin<E, P, R, C = {}>
  extends Destructible
  implements IRenderPlugin<E, P, R, C>
{
  config: IBasePluginConfig = {};

  abstract match(params: IRenderPluginMatchParams<E, P>): boolean;

  abstract render(params: IRenderPluginRenderParams<E, P, R, C>): R;
}
