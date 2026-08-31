/** @jsxImportSource @flowdown/reactive */

import type { IReactiveState } from '@flowdown/reactive';
import type { IRehypePlugin } from '@flowdown/types';

import { BaseStateClosure, D, toState } from '@flowdown/reactive';

import type { HastRoot } from '../../../../typings';
import type { IBlockState } from '../../../base';
import type { BlockCompilerStateClosureParams, IBlockCompilerStateClosure } from './type';

import { BlockListStateClosure, BlockSourceStateClosure } from './states';

export { BlockStateClosure } from './states/block-list/states/block';
export * from './type';
export * from './utils';

export class BlockCompilerStateClosure
  extends BaseStateClosure<IBlockState<HastRoot>[], BlockCompilerStateClosureParams>
  implements IBlockCompilerStateClosure
{
  protected render() {
    const { config, getRehypes, getRemarks, sections } = this.inputs;

    let rehypes: IReactiveState<IRehypePlugin[]> | null = null;

    const getSharedRehypes = () => {
      rehypes ??= toState(getRehypes());

      return rehypes;
    };

    return (
      <BlockListStateClosure
        createSource={(context) => (
          <BlockSourceStateClosure
            config={config}
            context={context}
            getRehypes={D(getSharedRehypes)}
            getRemarks={D(getRemarks)}
          />
        )}
        sections={sections}
      />
    );
  }
}
