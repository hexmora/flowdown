import type { BreakLineProps } from '../../../../types';

export const BreakLineRenderer = ({ Raw, ...props }: BreakLineProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  return <br {...props} />;
};
