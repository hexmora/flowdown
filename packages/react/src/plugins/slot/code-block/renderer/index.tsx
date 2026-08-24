import type { CodeBlockProps } from '../../../../types';

import { createTypeOfSlot } from '../../../../components/slot-renderer/utils';

const CodeHeader = /*#__PURE__*/ createTypeOfSlot('CodeHeader');

const CodeHighlighter = /*#__PURE__*/ createTypeOfSlot('CodeHighlighter');

export const CodeBlockRenderer = ({ Raw, ...props }: CodeBlockProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  const { code, language, loading, meta, onCopy, showHeader = true, ...elementProps } = props;

  return (
    <div {...elementProps} aria-busy={loading || undefined}>
      {showHeader ? (
        <CodeHeader code={code} language={language} meta={meta} onCopy={onCopy} />
      ) : null}
      <CodeHighlighter code={code} language={language} meta={meta} />
    </div>
  );
};
