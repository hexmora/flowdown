import type { RenderPatchesMapperInputs } from './type';

export const isInputsEqual = <R>(
  left: RenderPatchesMapperInputs<R>,
  right: RenderPatchesMapperInputs<R>,
): boolean => {
  return (
    left.patches.length === right.patches.length &&
    left.patches.every((patch, index) => {
      const other = right.patches[index];

      return patch.key === other?.key && patch.render === other?.render;
    })
  );
};
