/**
 * @jsxImportSource functive
 */

import type { IBlockState } from '@fluxdown/types';

import { type JSXDescriptor, once } from 'functive';

import type { SmoothInputs } from './type';

import { CutoffBlocks, SmoothCursor } from './states';

export * from './modules';
export * from './type';

export const Smooth = /*#__PURE__*/ once(function Smooth<T>(
  inputs: SmoothInputs<T>,
): JSXDescriptor<IBlockState<T>[]> {
  return <CutoffBlocks<T> items={inputs.source} end={<SmoothCursor<T> {...inputs} />} />;
});
