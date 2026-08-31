import { BaseStateClosure, toState } from '@flowdown/reactive';
import { isEqual } from 'lodash-es';

import type { HastRoot } from '../../../../../../../../typings';
import type { BlockRemarksConfig } from '../../../../type';
import type { BlockSourceStateClosureParams } from './type';

import { markdownToHast } from './utils';

export * from './type';

export class BlockSourceStateClosure extends BaseStateClosure<
  HastRoot,
  BlockSourceStateClosureParams
> {
  protected render() {
    const { config, context, getRehypes, getRemarks } = this.inputs;

    const section = this.map(context, (currentContext) => currentContext.section, isEqual);

    const remarksConfig = this.combineMap(
      [config, context],
      ([{ repairEnding, ...restConfig }, currentContext]): BlockRemarksConfig => {
        const { meta, section: currentSection } = currentContext;

        const { blockCount, currentIndex } = meta;

        return {
          ...restConfig,
          patches: currentSection.patches,
          repairEnding: repairEnding && currentIndex === blockCount - 1,
        };
      },
      isEqual,
    );

    const remarks = toState(getRemarks(remarksConfig));

    const rehypes = toState(getRehypes());

    return this.combineMap(
      [section, remarks, rehypes],
      ([currentSection, currentRemarks, currentRehypes]) => {
        return markdownToHast({
          text: currentSection.text,
          remarks: currentRemarks,
          rehypes: currentRehypes,
        });
      },
      isEqual,
    );
  }
}
