import type { IRenderPatchItem } from '@flowdown/core';
import type { Element, ElementContent, Parent, RootContent } from 'hast';
import type { ReactNode } from 'react';
import type { IReactiveState } from 'reactive';

import { isString } from 'lodash-es';
import { Fragment } from 'react';

import type { IReactRenderPlugin } from '../../types';
import type { RenderNodeParams } from './type';

import { PATCH_MARKER } from '../../consts';
import { getReactProps, isHastElement, isHastParent } from '../../utils';

const isElementContent = (node: RootContent): node is ElementContent =>
  node.type === 'comment' || node.type === 'element' || node.type === 'text';

const getChildKey = (node: RootContent, fallbackIndex: number) => {
  if (
    node.type === 'element' &&
    node.properties?.dataParserPatch === PATCH_MARKER &&
    isString(node.properties.dataPatchKey)
  ) {
    return `patch:${node.properties.dataPatchKey}`;
  }

  const tagName = node.type === 'element' ? `:${node.tagName}` : '';

  return `${fallbackIndex}:${node.type}${tagName}`;
};

export const renderParentChildren = (
  parent: Parent,
  parents: Parent[],
  patches: IReactiveState<IRenderPatchItem<ReactNode>[]>,
  plugins: IReactRenderPlugin[],
): ReactNode[] =>
  parent.children.map((child, index) => {
    if (!isElementContent(child)) {
      return null;
    }

    return (
      <Fragment key={getChildKey(child, index)}>
        {renderNode({ node: child, parents, patches, plugins })}
      </Fragment>
    );
  });

const renderNode = ({ node, parents, patches, plugins }: RenderNodeParams): ReactNode => {
  const childParents = isHastParent(node) ? [...parents, node] : parents;

  const render = (child: ElementContent) =>
    renderNode({ node: child, parents: childParents, patches, plugins });

  const renderChildren = (target?: Parent) => {
    const parent = target ?? (isHastParent(node) ? node : null);

    if (!parent) {
      return null;
    }

    const nextParents = parent === node ? childParents : [...childParents, parent];

    return renderParentChildren(parent, nextParents, patches, plugins);
  };

  const getProps = (target?: Element) =>
    getReactProps(target ?? (isHastElement(node) ? node : undefined));

  for (const plugin of plugins) {
    if (!plugin.match({ node, parents })) {
      continue;
    }

    return plugin.render({
      getProps,
      node,
      parents,
      patches,
      render,
      renderChildren,
    });
  }

  return null;
};
