const originals = new Map<string, PropertyDescriptor | undefined>();

/** Stubs both existing and absent globals, preserving their original descriptors. */
export function stubGlobal(name: string, value: unknown): void {
  if (!originals.has(name)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }

  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

export function restoreGlobals(): void {
  for (const [name, descriptor] of originals) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  }

  originals.clear();
}
