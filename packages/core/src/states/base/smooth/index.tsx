/**
 * @jsxImportSource reactive
 */

import { type JSXDescriptor, once } from 'reactive';

import type { IBlockState } from '../base-block';
import type { SmoothInputs } from './type';

import { CutoffBlocks, SmoothCursor } from './states';

export * from './type';

export const Smooth = /*#__PURE__*/ once(function Smooth<T>(
  inputs: SmoothInputs<T>,
): JSXDescriptor<IBlockState<T>[]> {
  return <CutoffBlocks<T> items={inputs.source} end={<SmoothCursor<T> {...inputs} />} />;
});
