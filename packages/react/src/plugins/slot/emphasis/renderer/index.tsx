import type { EmphasisProps } from '../../../../types';

export const EmphasisRenderer = ({ Raw, ...props }: EmphasisProps) => {
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

  return <em {...elementProps}>{children}</em>;
};
