import type { IPluggable } from '@fluxdown/types';

import { memoReturns } from 'functive';

import type { IRenderPlugin } from '../../../../externals';
import type { RenderPluggablesInputs } from './type';

import { isPluggablesEqual, toPluggable } from '../../../base';

export * from './type';

export const RenderPluggables = /*#__PURE__*/ memoReturns(function RenderPluggables<
  E,
  P,
  R,
  C = {},
>({
  extras,
}: RenderPluggablesInputs<E, P, R, C>): IPluggable<IRenderPlugin<E, P, R, C>, unknown>[] {
  return toPluggable(extras);
}, isPluggablesEqual);
