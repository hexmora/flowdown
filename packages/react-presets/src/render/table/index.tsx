import { assert } from '@fluxdown/utils';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin, createTypeOfSlot, isElementWithTag } from '../../base';

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
