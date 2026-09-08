/**
 * @jsxImportSource reactive
 */

import { type JSXDescriptor, once } from 'reactive';

import type { SmoothCursorInputs } from './type';

import { BlockLengths, CursorPosition, type SmoothPosition, SmoothTicks } from './states';

export * from './type';

export const SmoothCursor = /*#__PURE__*/ once(function SmoothCursor<T>({
  source,
  ...inputs
}: SmoothCursorInputs<T>): JSXDescriptor<SmoothPosition> {
  return (
    <CursorPosition
      {...inputs}
      lengths={<BlockLengths<T> source={source} />}
      ticks={<SmoothTicks enabled={inputs.enabled} ticker={inputs.ticker} />}
    />
  );
});
