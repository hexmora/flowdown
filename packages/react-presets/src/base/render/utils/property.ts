import { isNumber, isString } from 'lodash-es';

export const getStringProperty = (value: unknown): string | undefined => {
  if (isString(value)) {
    return value;
  }

  if (isNumber(value)) {
    return String(value);
  }

  return undefined;
};
