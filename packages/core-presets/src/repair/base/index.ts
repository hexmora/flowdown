import type {
  IRepairPlugin,
  RepairPluginHookType,
  RepairPluginRunner,
  RepairPluginSystemConfig,
} from '@fluxdown/types';

import { Destructible } from 'functive';
import { noop } from 'lodash-es';

export abstract class BaseRepairPlugin extends Destructible implements IRepairPlugin {
  readonly config: RepairPluginSystemConfig = {};

  abstract runner: RepairPluginRunner | RepairPluginRunner[];

  before: RepairPluginHookType = noop;

  after: RepairPluginHookType = noop;

  beforeEach: RepairPluginHookType = noop;

  afterEach: RepairPluginHookType = noop;
}
