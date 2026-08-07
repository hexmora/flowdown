import type { StateSource } from '@flowdown/reactive';
import type { IRawPatchItem } from '@flowdown/types';

export type { IRawPatchItem } from '@flowdown/types';

export interface IBlockSection {
  text: string;

  patches: IRawPatchItem[];
}

export type TextChunkerStateClosureParams = {
  text: StateSource<string>;

  patches: StateSource<IRawPatchItem[]>;
};
