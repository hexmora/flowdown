import { useCallback, useEffect, useRef, useState } from 'react';

import type { CopyOptions, CopyState } from './type';

import { COPY_FEEDBACK_MS } from './consts';
import { copyText } from './utils';

export const useCopy = ({ code, language, meta, onCopy }: CopyOptions) => {
  const [state, setState] = useState<CopyState | null>(null);
  const activeRequest = useRef<symbol | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      activeRequest.current = null;

      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [code, language, meta]);

  const copy = useCallback(async () => {
    if (activeRequest.current !== null) {
      return;
    }

    const request = Symbol();

    activeRequest.current = request;
    setState({ code, language, meta, request, status: 'copying' });

    let copied = false;

    try {
      copied = await copyText(code);
    } catch {
      // Browsers can deny both clipboard APIs; leave the action available to retry.
    }

    if (activeRequest.current !== request) {
      return;
    }

    if (!copied) {
      activeRequest.current = null;
      setState(null);
      return;
    }

    setState({ code, language, meta, request, status: 'copied' });
    timer.current = setTimeout(() => {
      activeRequest.current = null;
      timer.current = null;
      setState(null);
    }, COPY_FEEDBACK_MS);

    onCopy?.({ code, language, meta });
  }, [code, language, meta, onCopy]);

  const isCurrent =
    state?.request === activeRequest.current &&
    state?.code === code &&
    state?.language === language &&
    state?.meta === meta;

  return {
    copy,
    isCopied: isCurrent && state?.status === 'copied',
    isCopying: isCurrent && state?.status === 'copying',
  };
};
