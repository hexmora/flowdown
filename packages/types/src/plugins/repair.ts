import type {
  IDestructible,
  OmitWithType,
  ProcessMdastParams,
  ProcessMdastRunnerParams,
} from '@flowdown/utils';
import type { Parent, RootContent } from 'mdast';

import type { IBasePluginConfig, IPluginWithConfig } from './base';

/**
 * Framework-owned execution metadata for a repair plugin.
 */
export type RepairPluginConfig = {
  /**
   * Enables the plugin only when ending repair is enabled.
   * @default false
   */
  ending?: boolean;
} & OmitWithType<ProcessMdastParams, 'node' | 'runner'>;

/**
 * Framework-owned metadata used to schedule and execute a repair plugin.
 */
export type RepairPluginSystemConfig = Readonly<IBasePluginConfig & RepairPluginConfig>;

/**
 * Additional helpers available only to repair plugin runners.
 */
export interface RepairPluginRunnerExtraParams {
  /**
   * Runs the same repair plugin recursively from another parent node.
   */
  recursive: (node: Parent) => void;
}

/**
 * Parameters passed to a repair plugin runner.
 */
export type RepairPluginRunnerParams<T extends RootContent | Parent = Parent> =
  ProcessMdastRunnerParams<T> & RepairPluginRunnerExtraParams;

/**
 * Runner function that can inspect and mutate visited mdast nodes.
 */
export type RepairPluginRunner<T extends RootContent | Parent = Parent> = (
  /**
   * Current mdast visit payload plus repair-specific helpers.
   */
  params: RepairPluginRunnerParams<T>,
) => void;

/**
 * Lifecycle hook invoked around repair plugin execution.
 */
export type RepairPluginHookType = (
  /**
   * Node passed to the repair lifecycle hook.
   */
  node: Parent | RootContent,
) => void;

/**
 * Contract implemented by mdast repair plugins.
 */
export interface IRepairPlugin extends IDestructible, IPluginWithConfig<RepairPluginConfig> {
  /**
   * Framework metadata. Plugin-specific constructor options are intentionally
   * kept separate from this object.
   */
  readonly config: RepairPluginSystemConfig;

  /**
   * One or more runners executed for this plugin.
   */
  runner: RepairPluginRunner | RepairPluginRunner[];

  /**
   * Hook called before all runners for this plugin.
   */
  before: RepairPluginHookType;

  /**
   * Hook called after all runners for this plugin.
   */
  after: RepairPluginHookType;

  /**
   * Hook called before each runner for this plugin.
   */
  beforeEach: RepairPluginHookType;

  /**
   * Hook called after each runner for this plugin.
   */
  afterEach: RepairPluginHookType;
}
