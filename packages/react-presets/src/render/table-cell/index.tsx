import { assert } from '@fluxdown/utils';
import { isString } from 'lodash-es';
import { createElement } from 'react';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin, isElementWithTag } from '../../base';

export class TableCellRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-table-cell';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'td', 'th');
  }

  render({ getProps, node, renderChildren }: ReactRenderParams) {
    assert(isElementWithTag(node, 'td', 'th'));

    const { align: _align, ...props } = getProps(node);

    const align = node.properties?.align;

    return createElement(
      node.tagName,
      isString(align) ? { ...props, align } : props,
      renderChildren(node),
    );
  }
}
