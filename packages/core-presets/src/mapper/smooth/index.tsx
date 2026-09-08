/**
 * @jsxImportSource reactive
 */

import type { IBlockState } from '@flowdown/types';

import { type JSXDescriptor, once } from 'reactive';

import type { SmoothInputs } from './type';

import { CutoffBlocks, SmoothCursor } from './states';

export * from './modules';
export * from './type';

export const Smooth = /*#__PURE__*/ once(function Smooth<T>(
  inputs: SmoothInputs<T>,
): JSXDescriptor<IBlockState<T>[]> {
  return <CutoffBlocks<T> items={inputs.source} end={<SmoothCursor<T> {...inputs} />} />;
});
