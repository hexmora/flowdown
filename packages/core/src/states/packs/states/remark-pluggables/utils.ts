import { isEqual } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { RemarkPluggablesMapperInputs } from './type';

import { isPluggablesEqual } from '../../../base/plugin-builder/utils';

export const isInputsEqual = (
  left: RemarkPluggablesMapperInputs,
  right: RemarkPluggablesMapperInputs,
): boolean => {
  return (
    isEqual(left.config, right.config) &&
    isPluggablesEqual(left.extras, right.extras) &&
    shallowEqual(left.repairs, right.repairs)
  );
};
