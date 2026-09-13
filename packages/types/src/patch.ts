export type IRawPatchRange = number | [number, number];

export interface IRawPatchItem {
  key: string;

  range: IRawPatchRange;
}
