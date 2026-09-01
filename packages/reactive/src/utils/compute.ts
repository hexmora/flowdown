export type ComputeCalculator<T> = () => T;

export const compute = <T>(func: ComputeCalculator<T>): T => {
  return func();
};
