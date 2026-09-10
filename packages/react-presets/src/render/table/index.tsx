import type { IPluggableConfig } from '@flowdown/types';

import { assert } from '@flowdown/utils';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin, createTypeOfSlot, isElementWithTag } from '../../base';

const Table = /*#__PURE__*/ createTypeOfSlot('Table');

declare global {
  interface RenderConfigs {
    'render-table'?: IPluggableConfig<void>;
  }
}

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
