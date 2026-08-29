import type { IRenderPatchItem } from '@flowdown/core';
import type { ReactNode } from 'react';

import { memo, useCallback } from 'react';

import type { PatchReconcilerProps } from './type';

import { useStateValue } from '../../hooks';

type RenderPatch = IRenderPatchItem<ReactNode>;

export const PatchReconciler = /*#__PURE__*/ memo(function PatchReconciler({
  patchKey,
  patches,
  text,
}: PatchReconcilerProps) {
  const patchSelector = useCallback(
    (current: RenderPatch[]) => current.find(({ key }) => key === patchKey)?.render,
    [patchKey],
  );

  const patch = useStateValue(patches, patchSelector);

  return patch ? patch(text) : null;
});
