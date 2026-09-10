import type { IPluggableConfig } from '@flowdown/types';

import { assert } from '@flowdown/utils';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin, createTypeOfSlot, isElementWithTag } from '../../base';
import { getCode, getCodeElement, getLanguage, getMeta } from './utils';

const CodeBlock = /*#__PURE__*/ createTypeOfSlot('CodeBlock');

declare global {
  interface RenderConfigs {
    'render-code'?: IPluggableConfig<void>;
  }
}

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
