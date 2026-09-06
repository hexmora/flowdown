import { isEqual } from 'lodash-es';

import type { RehypePluggablesMapperInputs } from './type';

import { isPluggablesEqual } from '../../../base/plugin-builder/utils';

export const isInputsEqual = (
  left: RehypePluggablesMapperInputs,
  right: RehypePluggablesMapperInputs,
): boolean => {
  return isEqual(left.config, right.config) && isPluggablesEqual(left.extras, right.extras);
};
