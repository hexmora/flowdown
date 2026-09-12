import type { IReadableClosure } from 'functive';
import type { Root as HastRoot } from 'hast';

import type { IBlockState } from '../block';

export type MapperInputs<C = {}, T = IBlockState<HastRoot>[]> = C & {
  source: IReadableClosure<T>;
};
