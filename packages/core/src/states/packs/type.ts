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
import type { IReadableClosure, Newable } from 'reactive';

import type {
  IRenderPatchRender,
  IRenderPlugin,
  IScheduler,
  ITicker,
  RendererClass,
} from '../../externals';
import type { HastRoot } from '../../typings';
import type { MapperPluggable } from '../base';
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
  /**
   * Stable identifier for the patch.
   */
  key?: string;

  /**
   * Source text range replaced by the patch.
   */
  range: IRawPatchRange;

  /**
   * Render the replacement content.
   */
  render: IRenderPatchRender<R>;
}

export type TickerParams = [interval?: number];

export type SchedulerParams = [tuple?: number[]];

export type TickerType = 'raf' | 'interval';

export type SchedulerType = 'spring';

export type SmoothTickerClass = Newable<ITicker, TickerParams>;

export type SmoothSchedulerClass = Newable<IScheduler, SchedulerParams>;

export interface BaseSmoothConfig {
  /**
   * Whether progressive rendering is enabled.
   */
  enabled: boolean;

  /**
   * Resolved timestamp source constructor.
   */
  ticker: SmoothTickerClass;

  /**
   * Resolved progress scheduler constructor.
   */
  scheduler: SmoothSchedulerClass;
}

export interface SmoothConfig {
  /**
   * Reveal newly compiled content over successive ticks.
   * @default false
   */
  enabled?: boolean;

  /**
   * Built-in timestamp source name or a custom ticker constructor.
   */
  ticker: TickerType | SmoothTickerClass;

  /**
   * Built-in progress scheduler name or a custom scheduler constructor.
   */
  scheduler: SchedulerType | SmoothSchedulerClass;
}

export type CoreMappers = MapperPluggable[] | ((prev: MapperPluggable[]) => MapperPluggable[]);

export type CoreInputs<R, C = {}> = {
  /**
   * Renderer used to turn compiled blocks into output values.
   */
  Renderer: RendererClass<HastRoot, ElementContent, Parent, R, C>;

  /**
   * Markdown source text.
   */
  text: IReadableClosure<string>;

  /**
   * Source ranges and their render replacements.
   */
  patches: IReadableClosure<IPatchItem<R>[]>;

  /**
   * Compiler feature configuration.
   */
  build: IReadableClosure<BlockCompilerConfig>;

  /**
   * Configure progressive rendering of compiled content.
   * @default false
   */
  smooth?: IReadableClosure<boolean | SmoothConfig>;

  /**
   * Plugins used to render compiled content.
   */
  renders: IReadableClosure<IPluggable<IRenderPlugin<ElementContent, Parent, R, C>, unknown>[]>;

  /**
   * Additional Markdown tree plugins.
   */
  remarks?: IReadableClosure<IPluggable<IRemarkPlugin, unknown>[]>;

  /**
   * Additional HAST plugins.
   */
  rehypes?: IReadableClosure<IPluggable<IRehypePlugin, unknown>[]>;

  /**
   * Additional streaming Markdown repair plugins.
   */
  repairs?: IReadableClosure<IPluggable<IRepairPlugin, unknown>[]>;

  /**
   * Append block mappers or replace the default mapper list.
   */
  mappers?: IReadableClosure<CoreMappers>;
};
