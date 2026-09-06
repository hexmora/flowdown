export const getNow = () => {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
};
