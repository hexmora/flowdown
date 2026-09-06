import type {
  ApplyRepairsRemarkPlugin,
  PatchesRemarkPlugin,
  SyntaxMathRemarkPlugin,
} from '@flowdown/preset-plugins';
import type {
  IBasePluginConfig,
  IPluggable,
  IRawPatchRange,
  IRehypePlugin,
  IRemarkPlugin,
  IRepairPlugin,
} from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';
import type { IReadableClosure } from 'reactive';

import type { IRenderPatchRender, IRenderPluggable, RendererClass } from '../../externals';
import type { HastRoot } from '../../typings';
import type { BlockCompilerConfig } from '../hast';

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

export type CoreInputs<R, C = {}> = {
  Renderer: RendererClass<HastRoot, ElementContent, Parent, R, C>;

  text: IReadableClosure<string>;

  patches: IReadableClosure<IPatchItem<R>[]>;

  config: IReadableClosure<BlockCompilerConfig>;

  renders: IReadableClosure<IRenderPluggable<ElementContent, Parent, R, C, unknown>[]>;

  remarks?: IReadableClosure<IPluggable<IRemarkPlugin, unknown>[]>;

  rehypes?: IReadableClosure<IPluggable<IRehypePlugin, unknown>[]>;

  repairs?: IReadableClosure<IPluggable<IRepairPlugin, unknown>[]>;
};
