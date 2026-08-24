import { createElement } from 'react';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { isSafeTagName } from '../../../utils';
import { BaseReactRenderPlugin } from '../base';
import { VOID_TAG_NAMES } from './consts';

export class FallbackRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-fallback';

  readonly config = { priority: Infinity };

  match(_params: ReactRenderMatchParams) {
    return true;
  }

  render({ getProps, node, renderChildren }: ReactRenderParams) {
    if (node.type === 'text') {
      return node.value;
    }

    if (node.type !== 'element' || !isSafeTagName(node.tagName)) {
      return null;
    }

    const props = getProps(node);

    if (VOID_TAG_NAMES.includes(node.tagName)) {
      return createElement(node.tagName, props);
    }

    return createElement(node.tagName, props, renderChildren(node));
  }
}
