import type { TableProps } from '../../../../types';

export const TableRenderer = ({ Raw, ...props }: TableProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  const { children, ...elementProps } = props;

  return <table {...elementProps}>{children}</table>;
};
