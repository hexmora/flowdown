/**
 * @jsxImportSource functive
 */

import { type JSXDescriptor, once, useCreate } from 'functive';

import type { SmoothCursorInputs } from './type';

import { BlockLengths, CursorPosition, type SmoothPosition, SmoothTicks } from './states';

export * from './type';

export const SmoothCursor = /*#__PURE__*/ once(function SmoothCursor<T>({
  source,
  ...inputs
}: SmoothCursorInputs<T>): JSXDescriptor<SmoothPosition> {
  const lengths = useCreate(<BlockLengths<T> source={source} />);

  return (
    <CursorPosition
      {...inputs}
      lengths={lengths}
      ticks={<SmoothTicks enabled={inputs.enabled} lengths={lengths} ticker={inputs.ticker} />}
    />
  );
});
