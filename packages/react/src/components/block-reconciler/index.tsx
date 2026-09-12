import { useStateValue } from '@fluxdown/react-presets/base';
import { toState } from 'functive';
import { memo, useMemo } from 'react';

import type { BlockReconcilerProps } from './type';

import { renderParentChildren } from './utils';

export const BlockReconciler = /*#__PURE__*/ memo(function BlockReconciler({
  block,
  patches,
  plugins,
}: BlockReconcilerProps) {
  const root = useStateValue(block.value);

  const patchState = useMemo(() => toState(patches), [patches]);

  const pluginState = useMemo(() => toState(plugins), [plugins]);

  const renderPlugins = useStateValue(pluginState);

  return renderParentChildren(root, [root], patchState, renderPlugins);
});
