import { useRendersCount, useUpdate } from 'react-use';

import type { TrackedPreviewProps } from './type';

import { Flowdown } from '../../../src';

export const TrackedPreview = ({
  actions,
  ariaLabel,
  config,
  patches,
  text,
}: TrackedPreviewProps) => {
  const renderCount = useRendersCount();

  const update = useUpdate();

  return (
    <div className="playground-preview-body">
      <div className="playground-preview-tools">
        <output aria-label="Preview render count" className="playground-render-count">
          <span className="playground-render-count-value" key={renderCount}>
            {renderCount}
          </span>
        </output>

        {actions}

        <button onClick={update} type="button">
          Re-render preview
        </button>
      </div>

      <section aria-label={ariaLabel} className="playground-preview-content">
        {text.length > 0 ? <Flowdown config={config} patches={patches} text={text} /> : null}
      </section>
    </div>
  );
};
