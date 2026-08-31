import type { IPluggable, IRehypePlugin } from '@flowdown/types';

import { HoistFootnoteRehypePlugin, PRESET_REHYPE_PLUGINS } from '@flowdown/preset-plugins';
import { memo } from '@flowdown/reactive';
import { isEqual } from 'lodash-es';

import type { BlockCompilerConfig } from '../../../hast/block-compiler';

import { mergePluginPluggables } from '../utils';

type RehypePluggablesMapperProps = {
  config: BlockCompilerConfig;

  extras: readonly IPluggable<IRehypePlugin, unknown>[];
};

export const RehypePluggablesMapper = /*#__PURE__*/ memo(function RehypePluggablesMapper({
  config,
  extras,
}: RehypePluggablesMapperProps): IPluggable<IRehypePlugin, unknown>[] {
  const presets = PRESET_REHYPE_PLUGINS.filter(
    (Plugin) => Plugin !== HoistFootnoteRehypePlugin || config.footnote,
  );

  return mergePluginPluggables(presets, extras);
}, isEqual);
