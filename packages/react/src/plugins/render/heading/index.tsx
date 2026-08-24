import { assert } from '@flowdown/utils';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { getHeadingLevel, isHeadingNode } from './utils';

const Heading = /*#__PURE__*/ createTypeOfSlot('Heading');

export class HeadingRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-heading';

  match({ node }: ReactRenderMatchParams) {
    return isHeadingNode(node);
  }

  render({ getProps, node, parents, render, renderChildren }: ReactRenderParams) {
    assert(isHeadingNode(node));

    const level = getHeadingLevel(node.tagName);

    return (
      <Heading {...getProps(node)} current={node} level={level} parents={parents} render={render}>
        {renderChildren(node)}
      </Heading>
    );
  }
}
