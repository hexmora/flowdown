import type { BlockLengthsInputs, CursorPositionInputs } from './states';

export type { SmoothPosition } from './states';

export interface SmoothCursorInputs<T>
  extends BlockLengthsInputs<T>, Omit<CursorPositionInputs, 'lengths' | 'ticks'> {}
