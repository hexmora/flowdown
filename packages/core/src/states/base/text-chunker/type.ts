import type { IRawPatchItem } from '@flowdown/types';
import type { IReadableClosure } from 'reactive';

export type { IRawPatchItem } from '@flowdown/types';

export interface IBlockSection {
  text: string;

  patches: IRawPatchItem[];
}

export type TextChunkerInputs = {
  text: IReadableClosure<string>;

  patches: IReadableClosure<IRawPatchItem[]>;
};
