import { assert } from '@flowdown/utils';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { isElementWithTag } from '../base/utils';

const Blockquote = /*#__PURE__*/ createTypeOfSlot('Blockquote');

export class BlockquoteRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-blockquote';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'blockquote');
  }

  render({ getProps, node, parents, render, renderChildren }: ReactRenderParams) {
    assert(isElementWithTag(node, 'blockquote'));

    return (
      <Blockquote {...getProps(node)} current={node} parents={parents} render={render}>
        {renderChildren(node)}
      </Blockquote>
    );
  }
}
