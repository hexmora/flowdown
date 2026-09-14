export const withKey = <T extends object>(key: string, object: T): T => {
  Object.defineProperty(object, 'key', { value: key });

  return object;
};
