import { random } from 'lodash-es';
import { useEffect, useState } from 'react';

import type { SmoothStreamingProps } from './type';

import { Flowdown } from '../../../src';
import { SMOOTH_MARKDOWN } from './consts';
import '../playground/style.scss';

export const SmoothStreaming = ({ initialText = SMOOTH_MARKDOWN }: SmoothStreamingProps) => {
  const [cursor, setCursor] = useState(0);

  const [playing, setPlaying] = useState(false);

  const complete = cursor >= initialText.length;

  const text = initialText.slice(0, cursor);

  const status = complete
    ? 'Input complete'
    : playing
      ? 'Streaming'
      : cursor > 0
        ? 'Paused'
        : 'Ready';

  useEffect(() => {
    if (!playing || complete) {
      return;
    }

    const timer = window.setTimeout(
      () => {
        setCursor((current) => Math.min(current + random(1, 24), initialText.length));
      },
      random(50, 350),
    );

    return () => window.clearTimeout(timer);
  }, [complete, cursor, initialText.length, playing]);

  const handlePlay = () => {
    if (complete) {
      setCursor(0);
    }

    setPlaying(true);
  };

  const handlePause = () => {
    setPlaying(false);
  };

  const handleReset = () => {
    setPlaying(false);

    setCursor(0);
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

      <section aria-label="Streaming controls" className="playground-deck">
        <fieldset className="playground-settings">
          <legend>Randomized chunks</legend>

          <span>1–24 characters arrive every 50–350 ms.</span>
        </fieldset>

        <div className="playground-actions">
          <button
            className="playground-primary"
            disabled={(playing && !complete) || initialText.length === 0}
            onClick={handlePlay}
            type="button"
          >
            Play
          </button>

          <button disabled={!playing || complete} onClick={handlePause} type="button">
            Pause
          </button>

          <button onClick={handleReset} type="button">
            Reset
          </button>
        </div>
      </section>

      <div className="playground-workspace">
        <section aria-label="Incoming Markdown" className="playground-panel playground-editor">
          <div className="playground-panel-heading">
            <h2>Incoming chunks</h2>

            <span>
              {cursor}/{initialText.length} chars received
            </span>
          </div>

          <pre aria-label="Markdown stream" className="playground-playback-source">
            <span>{text}</span>

            <span className="playground-unplayed">{initialText.slice(cursor)}</span>
          </pre>
        </section>

        <section aria-label="Smooth preview" className="playground-panel playground-preview">
          <div className="playground-panel-heading">
            <h2>Smoothed render</h2>

            <span>Gradual reveal</span>
          </div>

          <div className="playground-preview-content">
            <Flowdown build={{ repair: true, repairEnding: true }} smooth text={text} />
          </div>
        </section>
      </div>
    </main>
  );
};
