import { useEffect, useMemo, useRef } from 'react';

export const useStatic = <T>(factory: () => T): T => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, []);
};

export const useDeferredUnmount = (callback: () => void): void => {
  const callbackRef = useRef(callback);

  const generationRef = useRef(0);

  callbackRef.current = callback;

  useEffect(() => {
    generationRef.current += 1;

    return () => {
      const generation = ++generationRef.current;

      queueMicrotask(() => {
        if (generationRef.current === generation) {
          callbackRef.current();
        }
      });
    };
  }, []);
};
