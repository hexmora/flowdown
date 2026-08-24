import { assert } from '@flowdown/utils';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { isElementWithTag } from '../base/utils';

const Paragraph = /*#__PURE__*/ createTypeOfSlot('Paragraph');

export class ParagraphRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-paragraph';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'p');
  }

  render({ getProps, node, parents, render, renderChildren }: ReactRenderParams) {
    assert(isElementWithTag(node, 'p'));

    if (node.children.length === 0) {
      return null;
    }

    return (
      <Paragraph {...getProps(node)} current={node} parents={parents} render={render}>
        {renderChildren(node)}
      </Paragraph>
    );
  }
}
