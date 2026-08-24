import type { StrongProps } from '../../../../types';

export const StrongRenderer = ({ Raw, ...props }: StrongProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  const {
    children,
    current: _current,
    parents: _parents,
    render: _render,
    ...elementProps
  } = props;

  return <strong {...elementProps}>{children}</strong>;
};
