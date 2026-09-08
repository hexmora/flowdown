import type { ThemedToken } from 'shiki/core';

export type HighlightedCode = {
  code: string;

  language: string;

  tokens: ThemedToken[][];
};
