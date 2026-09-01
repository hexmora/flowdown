import type { IPluggable, IPluginWithConfig } from '@flowdown/types';
import type { IDestructible } from 'reactive';

export interface IRenderPluginBaseParams<E, P> {
  node: E;

  parents: P[];
}

export type IRenderPluginMatchParams<E, P> = IRenderPluginBaseParams<E, P>;

export type IRenderPluginRenderParams<E, P, R, C = {}> = IRenderPluginBaseParams<E, P> & {
  render: (node: E) => R;
} & C;

export interface IRenderPlugin<E, P, R, C = {}> extends IPluginWithConfig, IDestructible {
  match: (params: IRenderPluginMatchParams<E, P>) => boolean;

  render: (params: IRenderPluginRenderParams<E, P, R, C>) => R;
}

export type IRenderPluggable<E, P, R, C = {}, O = void> = IPluggable<IRenderPlugin<E, P, R, C>, O>;
