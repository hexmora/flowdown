import type { IPluggableConfig } from '@flowdown/types';

import { assert } from '@flowdown/utils';
import { isString } from 'lodash-es';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin, createTypeOfSlot, isElementWithTag } from '../../base';

const Image = /*#__PURE__*/ createTypeOfSlot('Image');

declare global {
  interface RenderConfigs {
    'render-image'?: IPluggableConfig<void>;
  }
}

export class ImageRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-image';

  match({ node }: ReactRenderMatchParams) {
    return isElementWithTag(node, 'img');
  }

  render({ getProps, node, parents, render }: ReactRenderParams) {
    assert(isElementWithTag(node, 'img'));

    const src = node.properties?.src;

    if (!isString(src) || !src.trim()) {
      return null;
    }

    const { alt: _alt, src: _src, title: _title, ...props } = getProps(node);

    const alt = isString(node.properties?.alt) ? node.properties.alt : '';

    const title = isString(node.properties?.title) ? node.properties.title : undefined;

    return (
      <Image
        {...props}
        alt={alt}
        current={node}
        parents={parents}
        render={render}
        src={src}
        title={title}
      />
    );
  }
}
