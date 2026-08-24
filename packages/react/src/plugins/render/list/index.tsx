import { assert } from '@flowdown/utils';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { isElementWithTag } from '../base/utils';
import { hasClassName } from './utils';

const List = /*#__PURE__*/ createTypeOfSlot('List');

export class ListRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-list';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'ol', 'ul');
  }

  render({ getProps, node, parents, render, renderChildren }: ReactRenderParams) {
    assert(isElementWithTag(node, 'ol', 'ul'));

    return (
      <List
        {...getProps(node)}
        current={node}
        parents={parents}
        render={render}
        type={
          node.tagName === 'ol'
            ? 'ordered'
            : hasClassName(node.properties?.className, 'contains-task-list')
              ? 'task'
              : 'bullet'
        }
      >
        {renderChildren(node)}
      </List>
    );
  }
}
