import type { CodeHighlighterProps } from '../../../../types';

export const CodeHighlighterRenderer = ({ Raw, ...props }: CodeHighlighterProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  const { className, code, language, meta: _meta, ...preProps } = props;

  const codeClassName = className ?? (language ? `language-${language}` : undefined);

  return (
    <pre {...preProps}>
      <code className={codeClassName}>{code}</code>
    </pre>
  );
};
