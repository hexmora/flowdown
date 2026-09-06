import { memo, useMemo } from 'react';
import { toState } from 'reactive';

import type { BlockReconcilerProps } from './type';

import { useStateValue } from '../../hooks';
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
