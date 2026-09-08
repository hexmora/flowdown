import { renderToString } from 'katex';

export const katexTexToHtml = (tex: string, mode: 'display' | 'inline') => {
  try {
    return renderToString(tex, {
      displayMode: mode === 'display',
      maxExpand: 1000,
      maxSize: 20,
      output: 'htmlAndMathml',
      strict: true,
      throwOnError: true,
      trust: false,
    });
  } catch {
    return null;
  }
};
