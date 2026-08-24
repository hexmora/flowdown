import type { Distinctor, IReactiveState } from '@flowdown/reactive';

import { MutableState } from '@flowdown/reactive';
import { isUndefined } from 'lodash-es';
import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import { useDeferredUnmount, useStatic } from './base';

type StoreChangeFunction = () => void;

let deferDepth = 0;

let flushScheduled = false;

let pendingStoreChanges: StoreChangeFunction[] = [];

const useCommitEffect = isUndefined(globalThis.document) ? useEffect : useLayoutEffect;

const flushStoreChanges = () => {
  flushScheduled = false;

  const storeChanges = pendingStoreChanges;

  pendingStoreChanges = [];

  for (const storeChange of storeChanges) {
    storeChange();
  }
};

const scheduleStoreChange = (storeChange: StoreChangeFunction) => {
  if (!pendingStoreChanges.includes(storeChange)) {
    pendingStoreChanges.push(storeChange);
  }

  if (flushScheduled) {
    return;
  }

  flushScheduled = true;

  queueMicrotask(flushStoreChanges);
};

const notifyStoreChange = (storeChange: StoreChangeFunction) => {
  if (deferDepth > 0) {
    scheduleStoreChange(storeChange);

    return;
  }

  storeChange();
};

const deferStoreChanges = (update: () => void) => {
  deferDepth += 1;

  try {
    update();
  } finally {
    deferDepth -= 1;
  }
};

export const useStateOf = <T>(
  value: T,
  distinctor: Distinctor<T> = Object.is,
): IReactiveState<T> => {
  const distinctorRef = useRef(distinctor);

  distinctorRef.current = distinctor;

  const state = useStatic(
    () =>
      new MutableState({
        initial: value,
        distinctor: (from, to) => distinctorRef.current(from, to),
      }),
  );

  useCommitEffect(flushStoreChanges);

  if (!distinctorRef.current(state.value, value)) {
    deferStoreChanges(() => state.next(value));
  }

  useDeferredUnmount(() => state.destroy());

  return state;
};

export const useStateValue = <T>(state: IReactiveState<T>): T => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let active = true;

      let subscribed = false;

      const notify = () => {
        if (active) {
          onStoreChange();
        }
      };

      const subscription = state.subscribe(() => {
        if (!subscribed) {
          return;
        }

        notifyStoreChange(notify);
      });

      subscribed = true;

      return () => {
        active = false;

        subscription.unsubscribe();
      };
    },
    [state],
  );

  const getSnapshot = useCallback(() => state.value, [state]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export const useReactiveValue = useStateValue;
