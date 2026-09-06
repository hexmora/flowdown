import { useEffect, useState } from 'react';

import type { HighlightedCode } from './type';

export const useHighlighted = (code: string, language: string) => {
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function highlight() {
      try {
        const { highlightCode } = await import('./utils');
        const tokens = await highlightCode(code, language, controller.signal);

        if (!controller.signal.aborted && tokens) {
          setHighlighted({ code, language, tokens });
        }
      } catch {
        // Keep the source readable when an optional language chunk cannot load.
      }
    }

    void highlight();

    return () => {
      controller.abort();
    };
  }, [code, language]);

  return highlighted?.code === code && highlighted.language === language
    ? highlighted.tokens
    : null;
};
