import type { CodeBlockBaseContent, CodeHeaderProps } from '../../../../types';

export type CopyOptions = Pick<CodeHeaderProps, 'code' | 'language' | 'meta' | 'onCopy'>;

export type CopyState = CodeBlockBaseContent & {
  request: symbol;

  status: 'copying' | 'copied';
};
