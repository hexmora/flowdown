/* eslint-disable @typescript-eslint/no-explicit-any */
export type OmitWithType<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export interface Newable<T, A extends Array<any> = any[]> {
  new (...args: A): T;
}
