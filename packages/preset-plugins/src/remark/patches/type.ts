import type { IRawPatchItem } from '@flowdown/types';
import type { Parent, RootContent, Text } from 'mdast';

import type { ParserPatch } from '../../typings';

export interface PatchesRemarkPluginConfig {
  patches?: IRawPatchItem[];
}

export type NormalizedPatch = {
  end: number;

  item: IRawPatchItem;

  order: number;

  start: number;
};

export type TextPatch = NormalizedPatch & {
  decodedEnd: number;

  decodedStart: number;

  replacement?: string;
};

export type TextSourceMap = {
  boundaries: Map<number, number | null>;

  end: number;

  identity: boolean;

  raw?: string;

  start: number;
};

export type MappedTextPatch = {
  node: Text;

  patch: TextPatch;
};

export type MappedTextPoint = {
  decodedOffset: number;

  node: Text;
};

export type TextPatchTarget = {
  node: Text;

  patches: TextPatch[];
};

export type ParentPatchTarget = {
  index: number;

  parent: Parent;

  patches: ParserPatch[];
};

export type TextReplacement = {
  node: Text;

  replacements: RootContent[];
};
