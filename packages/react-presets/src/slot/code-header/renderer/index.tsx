import cn from 'classnames';
import { isFunction } from 'lodash-es';

import {
  type CodeHeaderAction,
  CodeHeaderInnerActionKey,
  type CodeHeaderProps,
} from '../../../base';
import CheckIcon from './assets/check.svg?react';
import CopyIcon from './assets/copy.svg?react';
import { useCopy } from './hooks';
import styles from './index.module.scss';
import { renderAction } from './utils';

export const CodeHeaderRenderer = ({ Raw: _Raw, ...props }: CodeHeaderProps) => {
  const { actions, className, code, language, left, meta, onCopy, ...elementProps } = props;
  const { copy, isCopied, isCopying } = useCopy({ code, language, meta, onCopy });

  const copyAction: CodeHeaderAction = {
    key: CodeHeaderInnerActionKey.Copy,
    target: (
      <button
        aria-label={isCopied ? 'Copied' : 'Copy'}
        aria-live="polite"
        disabled={isCopying}
        onClick={() => void copy()}
        type="button"
      >
        {isCopied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        {isCopied ? 'Copied' : 'Copy'}
      </button>
    ),
  };

  const resolvedActions = isFunction(actions)
    ? actions([copyAction])
    : [copyAction, ...(actions ?? [])];

  return (
    <div {...elementProps} className={cn(styles.root, className)}>
      <div className={styles.language}>{left ?? language ?? 'text'}</div>
      <div className={styles.actions}>{resolvedActions.map(renderAction)}</div>
    </div>
  );
};
