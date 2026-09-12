import type { IPluggable, IRehypePlugin } from '@fluxdown/types';

import { HoistFootnoteRehypePlugin, PRESET_REHYPE_PLUGINS } from '@fluxdown/core-presets/rehype';
import { memoReturns } from 'functive';

import type { RehypePluggablesMapperInputs } from './type';

import { isPluggablesEqual } from '../../../base';
import { mergePluginPluggables } from '../utils';

export * from './type';

export const RehypePluggablesMapper = /*#__PURE__*/ memoReturns(function RehypePluggablesMapper({
  config,
  extras,
}: RehypePluggablesMapperInputs): IPluggable<IRehypePlugin, unknown>[] {
  const presets = PRESET_REHYPE_PLUGINS.filter(
    (Plugin) => Plugin !== HoistFootnoteRehypePlugin || config.footnote,
  );

  return mergePluginPluggables(presets, extras);
}, isPluggablesEqual);
