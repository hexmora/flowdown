import type { IPluggable, IRehypePlugin } from '@fluxdown/types';

import { HoistFootnoteRehypePlugin, PRESET_REHYPE_PLUGINS } from '@fluxdown/core-presets/rehype';
import { memoReturns } from 'functive';

import type { RehypePluggablesInputs } from './type';

import { isPluggablesEqual, toPluggable } from '../../../base';
import { getPluggableClass } from '../utils';

export * from './type';

export const RehypePluggables = /*#__PURE__*/ memoReturns(function RehypePluggables({
  config,
  extras,
}: RehypePluggablesInputs): IPluggable<IRehypePlugin, unknown>[] {
  return toPluggable(extras, PRESET_REHYPE_PLUGINS).filter(
    (pluggable) => getPluggableClass(pluggable) !== HoistFootnoteRehypePlugin || config.footnote,
  );
}, isPluggablesEqual);
