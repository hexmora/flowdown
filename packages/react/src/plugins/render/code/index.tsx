import { assert } from '@flowdown/utils';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { isElementWithTag } from '../base/utils';
import { getCode, getCodeElement, getLanguage, getMeta } from './utils';

const CodeBlock = /*#__PURE__*/ createTypeOfSlot('CodeBlock');

export class CodeRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-code';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'pre');
  }

  render({ getProps, node }: ReactRenderParams) {
    assert(isElementWithTag(node, 'pre'));

    const codeElement = getCodeElement(node);

    const { 'data-meta': _dataMeta, dataMeta: _camelDataMeta, ...props } = getProps(node);

    return (
      <CodeBlock
        {...props}
        code={getCode(node, codeElement)}
        language={getLanguage(node, codeElement) ?? 'plaintext'}
        meta={getMeta(node, codeElement)}
      />
    );
  }
}
