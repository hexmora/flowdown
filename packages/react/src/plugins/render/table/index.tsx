import { assert } from '@flowdown/utils';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { isElementWithTag } from '../base/utils';

const Table = /*#__PURE__*/ createTypeOfSlot('Table');

export class TableRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-table';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'table');
  }

  render({ getProps, node, renderChildren }: ReactRenderParams) {
    assert(isElementWithTag(node, 'table'));

    return <Table {...getProps(node)}>{renderChildren(node)}</Table>;
  }
}
