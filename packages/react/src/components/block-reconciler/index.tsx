import { memo } from 'react';

import type { BlockReconcilerProps } from './type';

import { useStateValue } from '../../hooks';
import { renderParentChildren } from './utils';

export const BlockReconciler = /*#__PURE__*/ memo(function BlockReconciler({
  block,
  patches,
  plugins,
}: BlockReconcilerProps) {
  const root = useStateValue(block.value);

  const renderPlugins = useStateValue(plugins);

  return renderParentChildren(root, [root], patches, renderPlugins);
});
