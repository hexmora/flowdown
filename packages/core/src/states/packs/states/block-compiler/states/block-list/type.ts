import type { IReactiveState, StateSource } from '@flowdown/reactive';
import type { OmitWithType } from '@flowdown/utils';

import type { HastRoot } from '../../../../../../typings';
import type { IBlockMeta } from '../../../../../base';
import type { IBlockSection } from '../../type';

export type BlockListItemContext = {
  meta: OmitWithType<IBlockMeta, 'key' | 'sourceText'>;

  section: IBlockSection;
};

export type BlockListStateClosureParams = {
  createSource: (context: IReactiveState<BlockListItemContext>) => IReactiveState<HastRoot>;

  sections: StateSource<IBlockSection[]>;
};
