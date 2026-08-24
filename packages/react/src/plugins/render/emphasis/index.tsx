import { assert } from '@flowdown/utils';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { isElementWithTag } from '../base/utils';

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
