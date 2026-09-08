export const hasClassName = (value: unknown, target: string) => {
  const classNames = Array.isArray(value) ? value.map(String) : [String(value ?? '')];

  return classNames.some((item) => item.split(/\s+/).includes(target));
};
