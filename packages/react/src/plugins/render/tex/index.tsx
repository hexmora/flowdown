import { assert } from '@flowdown/utils';

import type { ReactRenderParams } from '../../../types';
import type { ReactRenderMatchParams } from '../base/type';

import { createTypeOfSlot } from '../../../components/slot-renderer/utils';
import { BaseReactRenderPlugin } from '../base';
import { isElementWithTag } from '../base/utils';
import { getTex, getTexMode } from './utils';

const Tex = /*#__PURE__*/ createTypeOfSlot('Tex');

export class TexRenderPlugin extends BaseReactRenderPlugin {
  static readonly key = 'render-tex';

  match(params: ReactRenderMatchParams) {
    return getTexMode(params) !== null && getTex(params) !== null;
  }

  render({ getProps, node, parents, render }: ReactRenderParams) {
    const mode = getTexMode({ node, parents });

    const tex = getTex({ node, parents });

    assert(isElementWithTag(node, 'span') && mode !== null && tex !== null);

    return (
      <Tex
        {...getProps(node)}
        current={node}
        mode={mode}
        parents={parents}
        render={render}
        tex={tex}
      />
    );
  }
}
