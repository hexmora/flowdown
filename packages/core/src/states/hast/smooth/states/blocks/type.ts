import type { IReactiveState } from '@flowdown/reactive';

import type { SmoothCursorFrame } from '../cursor';

export type SmoothBlocksStateClosureParams = {
  frame: IReactiveState<SmoothCursorFrame>;
};
