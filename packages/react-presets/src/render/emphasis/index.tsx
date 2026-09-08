import { assert } from '@flowdown/utils';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin, createTypeOfSlot, isElementWithTag } from '../../base';

const Emphasis = /*#__PURE__*/ createTypeOfSlot('Emphasis');

export class EmphasisRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-emphasis';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'em');
  }

  render({ getProps, node, parents, render, renderChildren }: ReactRenderParams) {
    assert(isElementWithTag(node, 'em'));

    return (
      <Emphasis {...getProps(node)} current={node} parents={parents} render={render}>
        {renderChildren(node)}
      </Emphasis>
    );
  }
}
