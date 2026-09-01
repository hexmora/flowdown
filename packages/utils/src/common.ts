import { isArray } from 'lodash-es';

export type ComputeCalculator<T> = () => T;

export const compute = <T>(func: ComputeCalculator<T>): T => {
  return func();
};

export type EnumeratedItem<T> = [index: number, item: T];

export const enumerate = <T>(items: Iterable<T>): EnumeratedItem<T>[] => {
  return [...items].map((item, index) => [index, item]);
};

export const indexOfValue = <T>(array: T[] | undefined, index: number): T | undefined => {
  return array?.[index];
};

export const ketOfValue = <T, P extends keyof T>(object: T, key: P): T[P] | undefined => {
  return object?.[key];
};

export interface cacheDiffMapParams<T, R> {
  prev: [T, R][] | Map<T, R>;
  current: T[];

  mapper: (params: T) => R;
  teardown?: (value: R, source: T) => void;
  /** @default Object.is */
  comparer?: (left: T, right: T) => boolean;
}

export const cacheDiffMap = <T, R>({
  prev,
  current,
  mapper,
  teardown,
  comparer = Object.is,
}: cacheDiffMapParams<T, R>): R[] => {
  const prevEntries = isArray(prev) ? prev : [...prev.entries()];
  const unmatchedEntries = [...prevEntries];

  const result = current.map((source) => {
    const matchedIndex = unmatchedEntries.findIndex(([prevSource]) => comparer(prevSource, source));

    if (matchedIndex === -1) {
      return mapper(source);
    }

    const [[, value]] = unmatchedEntries.splice(matchedIndex, 1);
    return value;
  });

  for (const [source, value] of unmatchedEntries) {
    teardown?.(value, source);
  }

  return result;
};
