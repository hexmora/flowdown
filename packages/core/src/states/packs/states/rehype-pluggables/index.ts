import type { IPluggable, IRehypePlugin } from '@flowdown/types';

import { HoistFootnoteRehypePlugin, PRESET_REHYPE_PLUGINS } from '@flowdown/preset-plugins';
import { memo } from 'reactive';

import type { RehypePluggablesMapperInputs } from './type';

import { isPluggablesEqual } from '../../../base/plugin-builder/utils';
import { mergePluginPluggables } from '../utils';
import { isInputsEqual } from './utils';

export * from './type';

export const RehypePluggablesMapper = /*#__PURE__*/ memo(
  function RehypePluggablesMapper({
    config,
    extras,
  }: RehypePluggablesMapperInputs): IPluggable<IRehypePlugin, unknown>[] {
    const presets = PRESET_REHYPE_PLUGINS.filter(
      (Plugin) => Plugin !== HoistFootnoteRehypePlugin || config.footnote,
    );

    return mergePluginPluggables(presets, extras);
  },
  isInputsEqual,
  isPluggablesEqual,
);
