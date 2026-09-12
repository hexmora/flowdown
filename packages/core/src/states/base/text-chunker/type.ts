import type { IRawPatchItem } from '@fluxdown/types';
import type { IReadableClosure } from 'functive';

export interface IBlockSection {
  text: string;

  patches: IRawPatchItem[];
}

export type TextChunkerInputs = {
  text: IReadableClosure<string>;

  patches: IReadableClosure<IRawPatchItem[]>;
};
