import type { StateClosureHookRuntime } from './index';

let currentRuntime: StateClosureHookRuntime | null = null;

export const hookOrderError = () => {
  return new TypeError('State closure hooks must be called in the same order on every render.');
};

export const withStateClosureHookRuntime = <T>(
  runtime: StateClosureHookRuntime | null,
  callback: () => T,
): T => {
  const previous = currentRuntime;

  currentRuntime = runtime;

  try {
    return callback();
  } finally {
    currentRuntime = previous;
  }
};

export const getCurrentStateClosureHookRuntime = (hook: string, kind?: 'mapper' | 'once') => {
  if (!currentRuntime || (kind && currentRuntime.kind !== kind)) {
    const usage = kind ? `${kind} functions` : 'mapper or once functions';

    throw new TypeError(`${hook} can only be used in ${usage}; hooks cannot be used in classes.`);
  }

  return currentRuntime;
};
