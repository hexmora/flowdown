import cn from 'classnames';

import type { CodeBlockProps } from '../../../../types';

import { createTypeOfSlot } from '../../../../components/slot-renderer/utils';
import styles from './index.module.scss';

const CodeHeader = /*#__PURE__*/ createTypeOfSlot('CodeHeader');

const CodeHighlighter = /*#__PURE__*/ createTypeOfSlot('CodeHighlighter');

export const CodeBlockRenderer = ({ Raw: _Raw, ...props }: CodeBlockProps) => {
  const {
    className,
    code,
    language,
    loading,
    meta,
    onCopy,
    showHeader = true,
    ...elementProps
  } = props;

  return (
    <div {...elementProps} className={cn(styles.root, className)} aria-busy={loading || undefined}>
      {showHeader ? (
        <CodeHeader code={code} language={language} meta={meta} onCopy={onCopy} />
      ) : null}
      <CodeHighlighter code={code} language={language} meta={meta} />
    </div>
  );
};
