export const immediateDescriptor = /*#__PURE__*/ Symbol('immediateDescriptor');

const stateClosureDescriptor = /*#__PURE__*/ Symbol('stateClosureDescriptor');

export const markStateClosureDescriptor = <T extends object>(descriptor: T): T => {
  Object.defineProperty(descriptor, stateClosureDescriptor, { value: true });

  return descriptor;
};

export const isMarkedStateClosureDescriptor = (value: unknown): value is object => {
  return (
    typeof value === 'object' && value !== null && Object.hasOwn(value, stateClosureDescriptor)
  );
};
