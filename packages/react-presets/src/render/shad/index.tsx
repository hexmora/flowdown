import { assert } from '@fluxdown/utils';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin, getTextContent, isElementWithTag } from '../../base';
import { ShadRenderer } from './renderer';
import { isShadNode } from './utils';

export class ShadRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-shad';

  match({ node }: ReactRenderMatchParams) {
    return isShadNode(node);
  }

  render({ node, renderChildren }: ReactRenderParams) {
    assert(isShadNode(node));

    const [leading, active] = node.children;

    assert(leading && isElementWithTag(leading, 'span'));

    assert(active && isElementWithTag(active, 'span'));

    return (
      <ShadRenderer
        active={renderChildren(active)}
        isActive={getTextContent(active).length > 0}
        leading={renderChildren(leading)}
      />
    );
  }
}
