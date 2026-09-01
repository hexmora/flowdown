export const isFinalPendingType = (type?: string | null): type is 'complete' | 'error' => {
  return type === 'complete' || type === 'error';
};
