import type { IBlockState, MapperInputs } from '@flowdown/types';
import type { Root as HastRoot } from 'hast';
import type { IReadableClosure } from 'reactive';

export interface ShadBaseInputs {
  /**
   * Whether newly visible text receives the tail shading.
   */
  enabled?: IReadableClosure<boolean>;

  /**
   * Maximum number of visible characters in the shaded tail.
   */
  length?: IReadableClosure<number>;
}

export type ShadInputs = MapperInputs<ShadBaseInputs, IBlockState<HastRoot>[]>;

export interface BaseShadConfig {
  enabled: boolean;

  length: number;
}

export interface ShadConfig {
  /**
   * Shade the tail of newly visible content.
   * @default true
   */
  enabled?: boolean;

  /**
   * Maximum number of visible characters in the shaded tail.
   * @default 2
   */
  length?: number;
}
