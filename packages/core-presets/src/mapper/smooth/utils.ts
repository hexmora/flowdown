import { isFunction } from 'lodash-es';

export const isEnableRAF = () => {
  return (
    isFunction(globalThis.requestAnimationFrame) && isFunction(globalThis.cancelAnimationFrame)
  );
};
