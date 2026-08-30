import type { PlaygroundProps } from './type';

import { TrackedPreview } from '../tracked-preview';
import { usePlayground } from './hooks/use-playground';
import './style.scss';

export type { PlaygroundProps } from './type';

export const Playground = ({ actions, patches, ...props }: PlaygroundProps) => {
  const {
    chunkSize,
    complete,
    config,
    cursor,
    handleBackToEditor,
    handlePause,
    handlePlay,
    handleProgress,
    handleReplay,
    handleResetSettings,
    handleResetText,
    handleSetting,
    handleStepBackward,
    handleStepForward,
    playbackMode,
    playbackText,
    previewText,
    progress,
    setChunkSize,
    setSpeed,
    setText,
    speed,
    status,
    stopped,
    text,
  } = usePlayground(props);

  return (
    <main className="playground-shell">
      <header className="playground-header">
        <div>
          <p className="playground-eyebrow">Flowdown workshop</p>
          <h1>Markdown Playground</h1>
        </div>

        <span aria-live="polite" className="playground-status">
          {status}
        </span>
      </header>

      <section aria-label="Playground controls" className="playground-deck">
        <fieldset className="playground-settings">
          <legend>Compiler settings</legend>

          <label>
            <input
              aria-label="Repair"
              checked={config.repair}
              onChange={(event) => handleSetting('repair', event.currentTarget.checked)}
              type="checkbox"
            />
            Repair
          </label>

          <label>
            <input
              aria-label="Repair ending"
              checked={config.repairEnding}
              onChange={(event) => handleSetting('repairEnding', event.currentTarget.checked)}
              type="checkbox"
            />
            Repair ending
          </label>

          <label>
            <input
              aria-label="Footnote"
              checked={config.footnote}
              onChange={(event) => handleSetting('footnote', event.currentTarget.checked)}
              type="checkbox"
            />
            Footnote
          </label>

          <label>
            <input
              aria-label="TeX"
              checked={config.tex}
              onChange={(event) => handleSetting('tex', event.currentTarget.checked)}
              type="checkbox"
            />
            TeX
          </label>
        </fieldset>

        <div className="playground-actions">
          <button onClick={handleResetSettings} type="button">
            Reset settings
          </button>

          <button onClick={handleResetText} type="button">
            Reset text
          </button>

          {playbackMode ? (
            <button className="playground-primary" onClick={handleBackToEditor} type="button">
              Back to editor
            </button>
          ) : (
            <button
              className="playground-primary"
              disabled={text.length === 0}
              onClick={handlePlay}
              type="button"
            >
              Play
            </button>
          )}
        </div>

        {playbackMode ? (
          <div className="playground-transport">
            <label>
              Speed
              <input
                aria-label="Speed"
                max={100}
                min={1}
                onChange={(event) => setSpeed(Number(event.currentTarget.value))}
                type="range"
                value={speed}
              />
              <output>{speed} ticks/s</output>
            </label>

            <label>
              Chunk size
              <input
                aria-label="Chunk size"
                max={20}
                min={1}
                onChange={(event) => setChunkSize(Number(event.currentTarget.value))}
                type="range"
                value={chunkSize}
              />
              <output>{chunkSize} chars</output>
            </label>

            <label className="playground-progress">
              Progress
              <input
                aria-label="Progress"
                max={100}
                min={0}
                onChange={(event) => handleProgress(Number(event.currentTarget.value))}
                type="range"
                value={progress}
              />
              <output>{Math.round(progress)}%</output>
            </label>

            <div className="playground-transport-actions">
              <button disabled={cursor === 0} onClick={handleStepBackward} type="button">
                Step backward
              </button>

              <button disabled={complete} onClick={handlePause} type="button">
                {stopped ? 'Resume' : 'Pause'}
              </button>

              <button disabled={complete} onClick={handleStepForward} type="button">
                Step forward
              </button>

              <button disabled={playbackText.length === 0} onClick={handleReplay} type="button">
                Replay
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="playground-workspace">
        <section aria-label="Markdown editor" className="playground-panel playground-editor">
          <div className="playground-panel-heading">
            <h2>Source</h2>
            <span>
              {playbackMode ? `${cursor}/${playbackText.length}` : `${text.length} chars`}
            </span>
          </div>

          {playbackMode ? (
            <pre aria-label="Markdown playback" className="playground-playback-source">
              <span>{playbackText.slice(0, cursor)}</span>
              <span className="playground-unplayed">{playbackText.slice(cursor)}</span>
            </pre>
          ) : (
            <label className="playground-textarea-label">
              <span>Markdown</span>
              <textarea
                aria-label="Markdown"
                onChange={(event) => setText(event.currentTarget.value)}
                spellCheck={false}
                value={text}
              />
            </label>
          )}
        </section>

        <section className="playground-panel playground-preview">
          <div className="playground-panel-heading">
            <h2>Preview</h2>
            <span>Reactive output</span>
          </div>

          <TrackedPreview
            actions={actions}
            ariaLabel={playbackMode ? 'Playback preview' : 'Preview'}
            build={config}
            patches={patches}
            text={previewText}
          />
        </section>
      </div>
    </main>
  );
};
