// oxlint-disable-next-line typescript/no-explicit-any
type Class<T = any> = new (...args: any[]) => T;

export function isClass(value: unknown): value is Class {
  if (typeof value !== 'function') {
    return false;
  }

  if (/^class\s/.test(Function.prototype.toString.call(value))) {
    return true;
  }

  const proto = value.prototype;
  if (!proto) {
    return false;
  }

  const names = Object.getOwnPropertyNames(proto);
  return names.length > 1;
}
