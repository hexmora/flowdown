/**
 * @jsxImportSource reactive
 */

import type { IBlockState, IPluggableConfig } from '@flowdown/types';
import type { Root as HastRoot } from 'hast';

import { type JSXDescriptor, once, useDefaults } from 'reactive';

import type { ShadBaseInputs, ShadInputs } from './type';

import { ShadBlocks, ShadProgress } from './states';

export * from './type';
export { SHAD_DATA_ATTR, SHAD_HOST_VALUE, SHAD_TAG_NAME } from './utils';

declare global {
  interface MapperConfigs {
    shad?: IPluggableConfig<ShadBaseInputs>;
  }
}

export const Shad = /*#__PURE__*/ once(function Shad({
  source,
  enabled: _enabled,
  length: _length,
}: ShadInputs): JSXDescriptor<IBlockState<HastRoot>[]> {
  const enabled = useDefaults(_enabled, false);

  const length = useDefaults(_length, 2);

  return (
    <ShadBlocks
      source={source}
      progress={<ShadProgress source={source} enabled={enabled} length={length} />}
    />
  );
});
