import { assert } from '@flowdown/utils';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { isElementWithTag } from '../base/utils';

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
