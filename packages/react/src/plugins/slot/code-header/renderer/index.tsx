import { isFunction } from 'lodash-es';

import {
  type CodeHeaderAction,
  CodeHeaderInnerActionKey,
  type CodeHeaderProps,
} from '../../../../types';
import { renderAction } from './utils';

export const CodeHeaderRenderer = ({ Raw, ...props }: CodeHeaderProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  const { actions, code, language, left, meta, onCopy, ...elementProps } = props;

  const copyAction: CodeHeaderAction = {
    key: CodeHeaderInnerActionKey.Copy,
    target: (
      <button type="button" onClick={() => onCopy?.({ code, language, meta })}>
        Copy
      </button>
    ),
  };

  const resolvedActions = isFunction(actions)
    ? actions([copyAction])
    : [copyAction, ...(actions ?? [])];

  return (
    <div {...elementProps}>
      {left ?? language}
      {resolvedActions.map(renderAction)}
    </div>
  );
};
