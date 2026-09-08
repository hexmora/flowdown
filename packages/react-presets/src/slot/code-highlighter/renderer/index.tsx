import cn from 'classnames';

import type { CodeHighlighterProps } from '../../../base';

import { useHighlighted } from './hooks';
import styles from './index.module.scss';

export const CodeHighlighterRenderer = ({ Raw: _Raw, ...props }: CodeHighlighterProps) => {
  const { className, code, language = 'plaintext', meta: _meta, ...elementProps } = props;
  const tokens = useHighlighted(code, language);

  return (
    // Keyboard users need to focus the overflow container to scroll long lines.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <pre {...elementProps} className={cn(styles.root, className)} tabIndex={0}>
      <code className={language ? `language-${language}` : undefined}>
        {tokens
          ? tokens.flatMap((line, lineIndex) => [
              lineIndex > 0 ? '\n' : null,
              ...line.map((token) => (
                <span
                  key={token.offset}
                  style={{
                    color: token.color,
                    fontStyle: (token.fontStyle ?? 0) & 1 ? 'italic' : undefined,
                    fontWeight: (token.fontStyle ?? 0) & 2 ? 'bold' : undefined,
                    textDecoration: (token.fontStyle ?? 0) & 4 ? 'underline' : undefined,
                  }}
                >
                  {token.content}
                </span>
              )),
            ])
          : code}
      </code>
    </pre>
  );
};
