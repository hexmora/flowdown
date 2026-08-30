import { useCallback, useEffect, useRef, useState } from 'react';

import type { SmoothStreamingPlaygroundProps, StreamingStatus } from './type';

import { Flowdown } from '../../../src';
import '../playground/style.scss';

export type { SmoothStreamingPlaygroundProps } from './type';

export const SmoothStreamingPlayground = ({ text }: SmoothStreamingPlaygroundProps) => {
  const [incomingText, setIncomingText] = useState('');

  const [smooth, setSmooth] = useState(true);

  const [status, setStatus] = useState<StreamingStatus>('Idle');

  const sessionRef = useRef(0);

  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);

      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;

      callback();
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current += 1;

      clearTimer();
    };
  }, [clearTimer]);

  const handlePlay = () => {
    clearTimer();

    const session = sessionRef.current + 1;

    sessionRef.current = session;

    setIncomingText('');

    setStatus('Streaming');

    if (text.length === 0) {
      setStatus('Input complete');

      return;
    }

    let cursor = 0;

    const scheduleBurst = () => {
      const sample = Math.random();

      const delay = 30 + Math.round(sample * 30);

      const burstSize = 4 + Math.floor(sample * 8);

      schedule(() => {
        if (sessionRef.current !== session) {
          return;
        }

        cursor = Math.min(cursor + burstSize, text.length);

        setIncomingText(text.slice(0, cursor));

        if (cursor < text.length) {
          scheduleBurst();

          return;
        }

        setStatus('Input complete');
      }, delay);
    };

    scheduleBurst();
  };

  const handleReset = () => {
    sessionRef.current += 1;

    clearTimer();

    setIncomingText('');

    setStatus('Idle');
  };

  const handleSmoothChange = (nextSmooth: boolean) => {
    setSmooth(nextSmooth);
  };

  return (
    <main className="playground-shell">
      <header className="playground-header">
        <div>
          <p className="playground-eyebrow">Flowdown workshop</p>
          <h1>Smooth Streaming</h1>
        </div>

        <span aria-live="polite" className="playground-status">
          {status}
        </span>
      </header>

      <section aria-label="Smooth streaming controls" className="playground-deck">
        <fieldset className="playground-settings">
          <legend>Output settings</legend>

          <label>
            <input
              aria-label="Smooth output"
              checked={smooth}
              onChange={(event) => handleSmoothChange(event.currentTarget.checked)}
              type="checkbox"
            />
            Smooth output
          </label>
        </fieldset>

        <div className="playground-actions">
          <button
            className="playground-primary"
            disabled={status === 'Streaming'}
            onClick={handlePlay}
            type="button"
          >
            Play stream
          </button>

          <button onClick={handleReset} type="button">
            Reset stream
          </button>
        </div>
      </section>

      <div className="playground-workspace">
        <section className="playground-panel">
          <div className="playground-panel-heading">
            <h2>Incoming stream</h2>
            <span>
              {incomingText.length}/{text.length}
            </span>
          </div>

          <section aria-label="Incoming stream" className="playground-playback-source">
            {incomingText}
          </section>
        </section>

        <section className="playground-panel playground-preview">
          <div className="playground-panel-heading">
            <h2>Smoothed preview</h2>
            <span>Reactive output</span>
          </div>

          <section aria-label="Smoothed preview" className="playground-preview-body">
            <Flowdown className="playground-preview-content" smooth={smooth} text={incomingText} />
          </section>
        </section>
      </div>
    </main>
  );
};
