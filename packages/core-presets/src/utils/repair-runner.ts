import type { IRepairPlugin } from '@flowdown/types';
import type { Parent, Root, RootContent } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import {
  type OmitWithType,
  processMdast,
  type ProcessMdastParams,
  type ProcessMdastRunnerParams,
} from '@flowdown/utils';
import { isFunction } from 'lodash-es';

type RepairProcessOptions<T extends Parent | RootContent> = OmitWithType<
  ProcessMdastParams<T>,
  'node' | 'runner'
>;

const getPluginName = (plugin: IRepairPlugin) => {
  return plugin.constructor?.name ?? 'Unnamed';
};

export type RunRepairPluginParams<T extends Parent | RootContent> = {
  /**
   * Repair plugin being executed.
   */
  plugin: IRepairPlugin;

  /**
   * Root node for the current repair pass.
   */
  node: T;

  /**
   * Whether plugin errors should be swallowed and logged.
   * @default true
   */
  safe?: boolean;
} & RepairProcessOptions<T>;

export const runRepairPlugin = <T extends Parent | RootContent>({
  plugin,
  node,
  safe = true,
  ...processOptions
}: RunRepairPluginParams<T>) => {
  const runners = isFunction(plugin.runner)
    ? [plugin.runner.bind(plugin)]
    : plugin.runner.map((item) => item.bind(plugin));
  const { ending: _ending, priority: _priority, ...pluginOptions } = plugin.config;

  plugin.before(node);

  for (const runner of runners) {
    plugin.beforeEach(node);

    const handleRunner = (params: ProcessMdastRunnerParams<T>) => {
      runner({
        ...params,
        recursive(nextNode) {
          runRepairPlugin<Parent>({
            plugin,
            node: nextNode,
            safe,
            ...processOptions,
          });
        },
      });
    };

    try {
      processMdast({
        node,
        runner: handleRunner,
        ...processOptions,
        ...pluginOptions,
      });
    } catch (error) {
      if (!safe) {
        throw error;
      }

      console.error(`[Repair plugin error: ${getPluginName(plugin)}]`, error);
    }

    plugin.afterEach(node);
  }

  plugin.after(node);
};

export type ProcessRepairByPluginsParams<T extends Parent | RootContent = Root> = {
  /**
   * Repair plugins to execute.
   */
  plugins: IRepairPlugin[];

  /**
   * Enables plugins that only run in ending repair mode.
   * @default false
   */
  ending?: boolean;
} & OmitWithType<RunRepairPluginParams<T>, 'plugin'>;

export const processRepairByPlugins = <T extends Parent | RootContent>({
  node,
  plugins,
  ending = false,
  safe,
  ...processOptions
}: ProcessRepairByPluginsParams<T>) => {
  const orderedPlugins = [...plugins];

  // oxlint-disable-next-line unicorn/no-array-sort -- ES2022 has no non-mutating native sort.
  orderedPlugins.sort(
    (left, right) =>
      (left.config.priority ?? PluginPriority.Default) -
      (right.config.priority ?? PluginPriority.Default),
  );

  const currentPlugins = orderedPlugins.filter((item) => {
    const { ending: endingOnly = false } = item.config;

    return endingOnly ? ending : true;
  });

  for (const plugin of currentPlugins) {
    runRepairPlugin({
      plugin,
      node,
      safe,
      ...processOptions,
    });
  }
};
