import type {
  ApplyRepairsRemarkPlugin,
  PatchesRemarkPlugin,
  SyntaxMathRemarkPlugin,
} from '@flowdown/preset-plugins';
import type { IReactiveState, Newable, StateSource } from '@flowdown/reactive';
import type {
  IBasePluginConfig,
  IPluggable,
  IRawPatchRange,
  IRehypePlugin,
  IRemarkPlugin,
  IRepairPlugin,
} from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import type {
  IRenderPatchRender,
  IRenderPluggable,
  IScheduler,
  ITicker,
  RendererClass,
} from '../../modules';
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
  /**
   * Stable patch identifier.
   */
  key?: string;

  /**
   * Source range replaced by the patch.
   */
  range: IRawPatchRange;

  /**
   * Renders the text covered by the patch.
   */
  render: IRenderPatchRender<R>;
}

export type SchedulerParams = [tuple?: number[]];

export type SchedulerType = 'spring';

export type TickerParams = [interval?: number];

export type TickerType = 'raf' | 'interval';

export type SmoothSchedulerClass = Newable<IScheduler, SchedulerParams>;

export type SmoothTickerClass = Newable<ITicker, TickerParams>;

export interface BaseSmoothConfig {
  enabled: boolean;

  ticker: SmoothTickerClass;

  scheduler: SmoothSchedulerClass;
}

export interface SmoothConfig {
  /**
   * Enables smooth rendered-content streaming.
   * @default false
   */
  enabled?: boolean;

  /**
   * Ticker used to drive smooth updates.
   * @default 'raf' when request and cancel animation-frame APIs are available; otherwise 'interval'
   */
  ticker: TickerType | SmoothTickerClass;

  /**
   * Scheduler used to calculate visible content-unit distance.
   * @default 'spring'
   */
  scheduler: SchedulerType | SmoothSchedulerClass;
}

export type CoreStateClosureParams<R, C = {}> = {
  /**
   * Renderer closure used to produce output values.
   */
  Renderer: RendererClass<HastRoot, ElementContent, Parent, R, C>;

  /**
   * Markdown source text.
   */
  text: StateSource<string>;

  /**
   * Smooth streaming configuration.
   * @default false
   */
  smooth?: StateSource<boolean | SmoothConfig>;

  /**
   * Inline render patches.
   */
  patches: IReactiveState<IPatchItem<R>[]>;

  /**
   * Markdown compiler feature configuration.
   */
  build: StateSource<BlockCompilerConfig>;

  /**
   * Render plugins.
   */
  renders: IReactiveState<IRenderPluggable<ElementContent, Parent, R, C, unknown>[]>;

  /**
   * Additional remark plugins.
   */
  remarks?: IReactiveState<IPluggable<IRemarkPlugin, unknown>[]>;

  /**
   * Additional rehype plugins.
   */
  rehypes?: IReactiveState<IPluggable<IRehypePlugin, unknown>[]>;

  /**
   * Additional repair plugins.
   */
  repairs?: IReactiveState<IPluggable<IRepairPlugin, unknown>[]>;
};
