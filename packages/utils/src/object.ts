import { defaults } from 'lodash-es';

export const defaultsBy = <T>(value: Partial<T>, source: T): T => {
  return defaults({}, value, source);
};
