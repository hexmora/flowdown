import type { IRawPatchItem } from '@flowdown/types';
import type { StateClosureSource } from 'reactive';

export type { IRawPatchItem } from '@flowdown/types';

export interface IBlockSection {
  text: string;

  patches: IRawPatchItem[];
}

export type TextChunkerStateClosureInputs = {
  text: StateClosureSource<string>;

  patches: StateClosureSource<IRawPatchItem[]>;
};
