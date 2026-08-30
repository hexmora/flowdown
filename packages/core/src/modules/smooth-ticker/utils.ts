export const getNow = () => {
  if (typeof performance === 'undefined') {
    return Date.now();
  }

  return performance.now();
};
