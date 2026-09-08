import { assert } from '@flowdown/utils';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin, createTypeOfSlot, isElementWithTag } from '../../base';

const BreakLine = /*#__PURE__*/ createTypeOfSlot('BreakLine');

export class BreakLineRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-break-line';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'br');
  }

  render({ getProps, node }: ReactRenderParams) {
    assert(isElementWithTag(node, 'br'));

    return <BreakLine {...getProps(node)} />;
  }
}
