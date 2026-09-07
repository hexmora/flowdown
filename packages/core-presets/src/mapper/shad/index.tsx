/**
 * @jsxImportSource reactive
 */

import type { IBlockState } from '@flowdown/types';
import type { Root as HastRoot } from 'hast';

import { type JSXDescriptor, once } from 'reactive';

import type { ShadInputs } from './type';

import { ShadBlocks, ShadProgress } from './states';

export * from './type';
export { SHAD_DATA_ATTR, SHAD_HOST_VALUE, SHAD_TAG_NAME } from './utils';

export const Shad = /*#__PURE__*/ once(function Shad(
  inputs: ShadInputs,
): JSXDescriptor<IBlockState<HastRoot>[]> {
  return <ShadBlocks source={inputs.source} progress={<ShadProgress {...inputs} />} />;
});
