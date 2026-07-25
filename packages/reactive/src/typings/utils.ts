/* eslint-disable @typescript-eslint/no-explicit-any */
export type { OmitWithType } from '@flowdown/utils';

export interface Newable<T, A extends Array<any> = any[]> {
  new (...args: A): T;
}

export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type Numbers<N extends number, Result extends number[] = []> = Result['length'] extends N
  ? Result
  : Numbers<N, [...Result, number]>;

export type ValueOf<T> = T[keyof T];
