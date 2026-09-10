import { PRESET_MAPPER_PLUGINS } from '@flowdown/core-presets/mapper';
import { memoReturns } from 'reactive';

import type { MapperPluggable } from '../../../base';
import type { MapperPluggablesInputs } from './type';

import { isPluggablesEqual, toPluggable } from '../../../base';

export * from './type';

export const MapperPluggables = /*#__PURE__*/ memoReturns(function MapperPluggables({
  extras,
}: MapperPluggablesInputs): MapperPluggable[] {
  return toPluggable(extras, PRESET_MAPPER_PLUGINS);
}, isPluggablesEqual);
