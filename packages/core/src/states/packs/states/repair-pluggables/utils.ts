import { isEqual } from 'lodash-es';

import type { RepairPluggablesMapperInputs } from './type';

import { isPluggablesEqual } from '../../../base/plugin-builder/utils';

export const isInputsEqual = (
  left: RepairPluggablesMapperInputs,
  right: RepairPluggablesMapperInputs,
): boolean => {
  return isEqual(left.config, right.config) && isPluggablesEqual(left.extras, right.extras);
};
