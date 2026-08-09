import type {
  ApplyRepairsRemarkPlugin,
  PatchesRemarkPlugin,
  SyntaxMathRemarkPlugin,
} from '@flowdown/preset-plugins';
import type { IReactiveState, StateSource } from '@flowdown/reactive';
import type {
  IBasePluginConfig,
  IRawPatchRange,
  IRehypePlugin,
  IRemarkPlugin,
  IRepairPlugin,
  PluginClass,
} from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import type { BaseRenderPlugin } from '../../externals/base-render-plugin';
import type { IRenderPatchRender, RendererClass } from '../../externals/base-renderer';
import type { HastRoot } from '../../typings';
import type { BlockCompilerConfig } from '../hast/block-compiler';

type PluginConstructor = (abstract new (...args: never[]) => {
  config: IBasePluginConfig;
}) & {
  readonly key: string;
};

type PluginConstructorConfig<C extends PluginConstructor> =
  ConstructorParameters<C> extends []
    ? never
    : Exclude<ConstructorParameters<C>[0], undefined | void>;

type CorePluginConfig<C extends PluginConstructor> = C extends
  | typeof PatchesRemarkPlugin
  | typeof SyntaxMathRemarkPlugin
  ? never
  : C extends typeof ApplyRepairsRemarkPlugin
    ? Omit<PluginConstructorConfig<C>, 'plugins' | 'ending'>
    : PluginConstructorConfig<C>;

export type PluginConfigs<C extends PluginConstructor = never> = [C] extends [never]
  ? Record<string, unknown>
  : CorePluginConfig<C> extends never
    ? never
    : Partial<{
        [P in C as CorePluginConfig<P> extends never ? never : P['key']]: CorePluginConfig<P>;
      }>;

export interface IPatchItem<R> {
  key?: string;

  range: IRawPatchRange;

  render: IRenderPatchRender<R>;
}

export type CoreStateClosureParams<R, C = {}> = {
  Renderer: RendererClass<HastRoot, ElementContent, Parent, R, C>;

  text: StateSource<string>;

  patches: IReactiveState<IPatchItem<R>[]>;

  config: StateSource<BlockCompilerConfig>;

  renders: IReactiveState<BaseRenderPlugin<ElementContent, Parent, R, C>[]>;

  pluginConfigs?: IReactiveState<PluginConfigs>;

  remarks?: IReactiveState<PluginClass<IRemarkPlugin>[]>;

  rehypes?: IReactiveState<PluginClass<IRehypePlugin>[]>;

  repairs?: IReactiveState<PluginClass<IRepairPlugin>[]>;
};
