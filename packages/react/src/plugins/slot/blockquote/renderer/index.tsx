import type { BlockquoteProps } from '../../../../types';

export const BlockquoteRenderer = ({ Raw, ...props }: BlockquoteProps) => {
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

  return <blockquote {...elementProps}>{children}</blockquote>;
};
