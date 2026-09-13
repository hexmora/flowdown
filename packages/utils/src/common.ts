import { isArray, reverse } from 'lodash-es';

type ComputeCalculator<T> = () => T;

export const compute = <T>(func: ComputeCalculator<T>): T => {
  return func();
};

interface cacheDiffMapParams<T, R> {
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
  const created: [T, R][] = [];

  let result: R[];

  try {
    result = current.map((source) => {
      const matchedIndex = unmatchedEntries.findIndex(([prevSource]) =>
        comparer(prevSource, source),
      );

      if (matchedIndex === -1) {
        const value = mapper(source);

        created.push([source, value]);

        return value;
      }

      const [[, value]] = unmatchedEntries.splice(matchedIndex, 1);

      return value;
    });

    for (const [source, value] of unmatchedEntries) {
      teardown?.(value, source);
    }
  } catch (error) {
    const errors = [error];

    for (const [source, value] of reverse(created)) {
      try {
        teardown?.(value, source);
      } catch (cleanupError) {
        errors.push(cleanupError);
      }
    }

    throw errors.length === 1
      ? error
      : new AggregateError(errors, 'Failed to map values and release newly created entries.');
  }

  return result;
};
