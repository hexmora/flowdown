import { memo } from 'react';

import type { PatchReconcilerProps } from './type';

import { useStateValue } from '../../hooks';

export const PatchReconciler = /*#__PURE__*/ memo(function PatchReconciler({
  patchKey,
  patches,
  text,
}: PatchReconcilerProps) {
  const currentPatches = useStateValue(patches);

  const patch = currentPatches.find(({ key }) => key === patchKey);

  return patch ? patch.render(text) : null;
});
