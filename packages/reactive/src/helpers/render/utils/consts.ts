export const immediateDescriptor = Symbol('immediateDescriptor');

const stateClosureDescriptors = new WeakSet<object>();

export const markStateClosureDescriptor = <T extends object>(descriptor: T): T => {
  stateClosureDescriptors.add(descriptor);

  return descriptor;
};

export const isMarkedStateClosureDescriptor = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null && stateClosureDescriptors.has(value);
};
