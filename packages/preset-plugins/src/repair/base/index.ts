import type { IRepairPlugin, RepairPluginHookType, RepairPluginRunner } from '@flowdown/types';

import { noop } from 'lodash-es';
import { Destructible } from 'reactive';

export abstract class BaseRepairPlugin extends Destructible implements IRepairPlugin {
  readonly config: IRepairPlugin['config'] = {};

  abstract runner: RepairPluginRunner | RepairPluginRunner[];

  before: RepairPluginHookType = noop;

  after: RepairPluginHookType = noop;

  beforeEach: RepairPluginHookType = noop;

  afterEach: RepairPluginHookType = noop;
}
