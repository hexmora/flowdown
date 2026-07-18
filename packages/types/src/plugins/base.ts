import type { Newable } from '@flowdown/utils';

/**
 * Priority buckets used to order plugins.
 */
export enum PluginPriority {
  /**
   * Runs before every other priority bucket.
   */
  Highest = -2,

  /**
   * Runs before the default priority bucket.
   */
  High = -1,

  /**
   * Uses the normal plugin priority.
   */
  Default = 0,

  /**
   * Runs after the default priority bucket.
   */
  Low = 1,

  /**
   * Runs after every other priority bucket.
   */
  Lowest = 2,
}

export type IBasePluginConfig = {
  /**
   * Controls the order in which plugins run.
   * @default 'PluginPriority.Default'
   */
  priority?: PluginPriority;
};

export type IPluginWithConfig<C = {}> = {
  readonly config: IBasePluginConfig & C;
};

export type PluginClass<T extends IPluginWithConfig, O = void> = Newable<
  T,
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type, @typescript-eslint/no-explicit-any
  O extends void ? any[] : [O]
> & {
  readonly key: string;
};

export type IPluggable<T extends IPluginWithConfig, O = void, P = O> =
  | PluginClass<T>
  | [PluginClass<T, P>, O];
