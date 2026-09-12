import type { DestructibleTarget } from '../../../../destructible';
import type { StateClosureRef } from '../type';

export type HookSlot =
  | {
      type: 'ref';

      value: StateClosureRef<unknown>;
    }
  | {
      type: 'current';

      value: unknown;
    }
  | {
      type: 'clearable';

      target: DestructibleTarget;
    };
