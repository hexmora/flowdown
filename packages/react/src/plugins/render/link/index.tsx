import { assert } from '@flowdown/utils';
import { isString } from 'lodash-es';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { isElementWithTag } from '../base/utils';

const Link = /*#__PURE__*/ createTypeOfSlot('Link');

export class LinkRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-link';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'a');
  }

  render({ getProps, node, parents, render, renderChildren }: ReactRenderParams) {
    assert(isElementWithTag(node, 'a'));

    const href = node.properties?.href;

    if (!isString(href) || !href.trim()) {
      return renderChildren(node);
    }

    const { href: _href, title: _title, ...props } = getProps(node);

    const title = isString(node.properties?.title) ? node.properties.title : undefined;

    return (
      <Link {...props} current={node} href={href} parents={parents} render={render} title={title}>
        {renderChildren(node)}
      </Link>
    );
  }
}
