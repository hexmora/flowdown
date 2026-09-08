import { PluginPriority } from '@flowdown/types';
import { assert } from '@flowdown/utils';
import { isString } from 'lodash-es';

import type { ReactRenderMatchParams, ReactRenderParams } from '../../base';

import { BaseReactRenderPlugin } from '../../base';
import { PatchReconciler } from './components/patch-reconciler';
import { isPatchNode } from './utils';

export class PatchRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-patch';

  readonly config = { priority: PluginPriority.Highest };

  match({ node }: ReactRenderMatchParams) {
    return isPatchNode(node);
  }

  render({ node, patches }: ReactRenderParams) {
    assert(isPatchNode(node));

    const patchText = node.properties.dataPatchText;

    return (
      <PatchReconciler
        patchKey={node.properties.dataPatchKey}
        patches={patches}
        text={isString(patchText) ? patchText : undefined}
      />
    );
  }
}
