import { assert } from '@fluxdown/utils';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin, createTypeOfSlot, isElementWithTag } from '../../base';

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
