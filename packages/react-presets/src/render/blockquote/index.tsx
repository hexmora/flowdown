import type { IPluggableConfig } from '@flowdown/types';

import { assert } from '@flowdown/utils';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin, createTypeOfSlot, isElementWithTag } from '../../base';

const Blockquote = /*#__PURE__*/ createTypeOfSlot('Blockquote');

declare global {
  interface RenderConfigs {
    'render-blockquote'?: IPluggableConfig<void>;
  }
}

export class BlockquoteRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-blockquote';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'blockquote');
  }

  render({ getProps, node, parents, render, renderChildren }: ReactRenderParams) {
    assert(isElementWithTag(node, 'blockquote'));

    return (
      <Blockquote {...getProps(node)} current={node} parents={parents} render={render}>
        {renderChildren(node)}
      </Blockquote>
    );
  }
}
