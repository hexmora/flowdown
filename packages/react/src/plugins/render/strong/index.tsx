import { assert } from '@flowdown/utils';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { isElementWithTag } from '../base/utils';

const Strong = /*#__PURE__*/ createTypeOfSlot('Strong');

export class StrongRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-strong';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'b', 'strong');
  }

  render({ getProps, node, parents, render, renderChildren }: ReactRenderParams) {
    assert(isElementWithTag(node, 'b', 'strong'));

    return (
      <Strong {...getProps(node)} current={node} parents={parents} render={render}>
        {renderChildren(node)}
      </Strong>
    );
  }
}
