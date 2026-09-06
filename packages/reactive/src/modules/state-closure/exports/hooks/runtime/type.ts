import type { DestructibleTarget } from '../../../../destructible';
import type { StateClosureRef } from '../type';

export type HookSlot =
  | { type: 'ref'; value: StateClosureRef<unknown> }
  | { type: 'clearable'; target: DestructibleTarget };
