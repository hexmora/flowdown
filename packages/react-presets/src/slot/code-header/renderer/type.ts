import type { CodeBlockBaseContent, CodeHeaderProps } from '../../../base';

export type CopyOptions = Pick<CodeHeaderProps, 'code' | 'language' | 'meta' | 'onCopy'>;

export type CopyState = CodeBlockBaseContent & {
  request: symbol;

  status: 'copying' | 'copied';
};
