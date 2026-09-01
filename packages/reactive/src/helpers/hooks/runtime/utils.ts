import { initial, isFunction, isObject } from 'lodash-es';

import type { StateClosureHookRuntime } from '.';
import type { DestructibleTarget } from '../../../modules/destructible';
import type { Distinctor, IReactiveState } from '../../../modules/reactive-state';
import type { IStateClosure, StateClosureSource } from '../../../modules/state-closure';
import type { StateMapper, StateValue, StateValues } from '../../operator';
import type {
  ClearableHookSlot,
  CombinedHookSlot,
  ComposeHookSlot,
  HookRef,
  HookSlot,
  MapHookSlot,
  RefHookSlot,
  SourceBinding,
  StateClosureHookSourceResolver,
} from './type';

import { BatchScheduler } from '../../../modules/batch-scheduler';
import { clearByTarget } from '../../../modules/destructible/utils';
import { MutableState } from '../../../modules/mutable-state';
import { combineMapState, isReactiveStateLike } from '../../operator';

let currentRuntime: StateClosureHookRuntime | null = null;

export const setCurrentStateClosureHookRuntime = (
  runtime: StateClosureHookRuntime | null,
): StateClosureHookRuntime | null => {
  const previousRuntime = currentRuntime;

  currentRuntime = runtime;

  return previousRuntime;
};

export const isCurrentStateClosureHookRuntime = (runtime: StateClosureHookRuntime): boolean => {
  return currentRuntime === runtime;
};

export const hookOrderError = () => {
  return new TypeError('State closure hooks must be called in the same order on every render.');
};

const isStateClosureLike = (value: unknown): value is IStateClosure<unknown> => {
  return (
    isObject(value) &&
    'value' in value &&
    'destroy' in value &&
    isFunction(value.destroy) &&
    isReactiveStateLike(value.value)
  );
};

const isBorrowedSource = (source: unknown) => {
  return isReactiveStateLike(source) || isStateClosureLike(source);
};

const getBorrowedState = (source: unknown): IReactiveState<unknown> => {
  if (isReactiveStateLike(source)) {
    return source;
  }

  if (isStateClosureLike(source)) {
    return source.value;
  }

  throw new TypeError('Invalid reactive state source.');
};

const createSourceBinding = (source: unknown): SourceBinding => {
  if (isBorrowedSource(source)) {
    return {
      kind: 'borrowed',
      source,
      state: getBorrowedState(source),
    };
  }

  return {
    kind: 'raw',
    state: MutableState.of(source),
  };
};

export const canUpdateSourceBinding = (binding: SourceBinding, source: unknown) => {
  if (binding.kind === 'raw') {
    return !isBorrowedSource(source);
  }

  return isBorrowedSource(source) && Object.is(binding.source, source);
};

export const updateSourceBinding = (binding: SourceBinding, source: unknown) => {
  if (binding.kind === 'raw') {
    binding.state.next(source);
  }
};

const completeRawSourceBinding = (binding: SourceBinding) => {
  if (binding.kind === 'raw') {
    binding.state.complete();
  }
};

const errorRawSourceBinding = (binding: SourceBinding, error: unknown) => {
  if (binding.kind === 'raw') {
    binding.state.error(error);
  }
};

const destroySourceBinding = (binding: SourceBinding) => {
  if (binding.kind === 'raw') {
    binding.state.destroy();
  }
};

export const destroySlots = (slots: HookSlot[]) => {
  let didThrow = false;

  let firstError: unknown;

  for (const slot of slots) {
    try {
      slot.destroy();
    } catch (error) {
      if (!didThrow) {
        didThrow = true;

        firstError = error;
      }
    }
  }

  if (didThrow) {
    throw firstError;
  }
};

export const createMapSlot = <S, R>(
  source: S,
  mapper: StateMapper<StateValue<S>, R>,
  distinctor?: Distinctor<R>,
): MapHookSlot => {
  const binding = createSourceBinding(source);

  const revision = MutableState.of(0);

  const mapperRef: HookRef<StateMapper<unknown, unknown>> = {
    current: mapper as StateMapper<unknown, unknown>,
  };

  const distinctorRef: HookRef<Distinctor<unknown> | undefined> = {
    current: distinctor as Distinctor<unknown> | undefined,
  };

  let destroyed = false;

  try {
    const value = combineMapState(
      [binding.state, revision],
      ([current], prev) => mapperRef.current(current, prev ? [prev[0][0], prev[1]] : null),
      (left, right) => distinctorRef.current?.(left, right) ?? Object.is(left, right),
    );

    return {
      binding,
      distinctor: distinctorRef,
      mapper: mapperRef,
      revision,
      type: 'map',
      value,
      completeRawSources: () => {
        BatchScheduler.batch(() => {
          completeRawSourceBinding(binding);

          revision.complete();
        });
      },
      destroy: () => {
        if (destroyed) {
          return;
        }

        destroyed = true;

        try {
          value.destroy();
        } finally {
          try {
            destroySourceBinding(binding);
          } finally {
            revision.destroy();
          }
        }
      },
      errorRawSources: (error) => {
        BatchScheduler.batch(() => {
          errorRawSourceBinding(binding, error);

          revision.error(error);
        });
      },
    };
  } catch (error) {
    try {
      destroySourceBinding(binding);
    } finally {
      revision.destroy();
    }

    throw error;
  }
};

export const createCombinedSlot = <const TSources extends [unknown, ...unknown[]], R>(
  type: 'combine' | 'combineMap',
  sources: [...TSources],
  mapper: StateMapper<StateValues<TSources>, R>,
  distinctor?: Distinctor<R>,
): CombinedHookSlot => {
  const bindings = sources.map(createSourceBinding);

  const revision = MutableState.of(0);

  const mapperRef: HookRef<StateMapper<unknown[], unknown>> = {
    current: mapper as StateMapper<unknown[], unknown>,
  };

  const distinctorRef: HookRef<Distinctor<unknown> | undefined> = {
    current: distinctor as Distinctor<unknown> | undefined,
  };

  let destroyed = false;

  try {
    const states = bindings.map(({ state }) => state) as [
      IReactiveState<unknown>,
      ...IReactiveState<unknown>[],
    ];

    const value = combineMapState(
      [...states, revision],
      (current, prev) =>
        mapperRef.current(initial(current), prev ? [initial(prev[0]), prev[1]] : null),
      (left, right) => distinctorRef.current?.(left, right) ?? Object.is(left, right),
    );

    return {
      bindings,
      distinctor: distinctorRef,
      mapper: mapperRef,
      revision,
      type,
      value,
      completeRawSources: () => {
        BatchScheduler.batch(() => {
          for (const binding of bindings) {
            completeRawSourceBinding(binding);
          }

          revision.complete();
        });
      },
      destroy: () => {
        if (destroyed) {
          return;
        }

        destroyed = true;

        try {
          value.destroy();
        } finally {
          try {
            for (const binding of bindings) {
              destroySourceBinding(binding);
            }
          } finally {
            revision.destroy();
          }
        }
      },
      errorRawSources: (error) => {
        BatchScheduler.batch(() => {
          for (const binding of bindings) {
            errorRawSourceBinding(binding, error);
          }

          revision.error(error);
        });
      },
    };
  } catch (error) {
    try {
      for (const binding of bindings) {
        destroySourceBinding(binding);
      }
    } finally {
      revision.destroy();
    }

    throw error;
  }
};

export const createComposeSlot = <T>(
  source: StateClosureSource<T>,
  resolveSource: StateClosureHookSourceResolver,
): ComposeHookSlot => {
  const resolved = resolveSource(source);

  let destroyed = false;

  return {
    source,
    type: 'compose',
    value: resolved.state,
    completeRawSources: () => {},
    destroy: () => {
      if (destroyed) {
        return;
      }

      destroyed = true;

      resolved.cleanup?.();
    },
    errorRawSources: () => {},
  };
};

export const createClearableSlot = <T extends DestructibleTarget>(target: T): ClearableHookSlot => {
  let destroyed = false;

  return {
    target,
    type: 'clearable',
    completeRawSources: () => {},
    destroy: () => {
      if (destroyed) {
        return;
      }

      destroyed = true;

      clearByTarget(target);
    },
    errorRawSources: () => {},
  };
};

export const createRefSlot = <T>(initialValue: T): RefHookSlot => {
  return {
    type: 'ref',
    value: { current: initialValue },
    completeRawSources: () => {},
    destroy: () => {},
    errorRawSources: () => {},
  };
};

export const getCurrentStateClosureHookRuntime = () => {
  if (!currentRuntime) {
    throw new TypeError(
      'State closure hooks can only be called while rendering a functional state closure.',
    );
  }

  return currentRuntime;
};
