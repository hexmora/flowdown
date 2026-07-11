import { defaults } from 'lodash-es';

export const defaultsPartial = <T>(value: T, source: Partial<T>) => {
  return defaults({}, value, source);
};
