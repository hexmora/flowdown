import type { ParagraphProps } from '../../../../types';

export const ParagraphRenderer = ({ Raw, ...props }: ParagraphProps) => {
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

  return <p {...elementProps}>{children}</p>;
};
