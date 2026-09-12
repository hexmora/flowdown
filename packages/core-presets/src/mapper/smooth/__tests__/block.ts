import type {
  BaseBlockItemInputs,
  IBlockMeta,
  IBlockState,
  IBlockStateCloneParams,
} from '@fluxdown/types';
import type { IReadableClosure } from 'functive';

import { BaseStateClosure, MutableState, render, S, toClosure } from 'functive';

type ArrayBlockInputs<T> = Pick<BaseBlockItemInputs<T[]>, 'meta' | 'range' | 'source'>;

export class ArrayBlock<T>
  extends BaseStateClosure<T[], ArrayBlockInputs<T>>
  implements IBlockState<T[]>
{
  private readonly rangeSource = this.defaults(this.inputs.range, null);

  private readonly baseLengthSource = this.map(this.inputs.source, (value) => value.length);

  private lengthSource: IReadableClosure<number> | null = null;

  get meta() {
    return this.inputs.meta.value;
  }

  get range() {
    return this.rangeSource.value;
  }

  get baseLength() {
    return this.baseLengthSource.value;
  }

  get length() {
    return (this.lengthSource ??= this.map(this.value, (value) => value.length)).value;
  }

  protected render() {
    return this.combineMap([this.inputs.source, this.rangeSource], ([value, range]) =>
      range ? value.slice(range.start, range.end) : value,
    );
  }

  fork({ meta, range }: IBlockStateCloneParams<T[]> = {}): IBlockState<T[]> {
    return new ArrayBlock({
      source: this.inputs.source,
      meta: toClosure(meta ?? this.inputs.meta),
      range: toClosure(range ?? this.rangeSource),
    });
  }
}

export const createArrayBlock = <T>(value: T[], key = 'block') => {
  const source = MutableState.of(value);

  const meta = MutableState.of<IBlockMeta>({
    key,
    sourceText: '',
    charStart: 0,
    charEnd: value.length,
    currentIndex: 0,
    blockCount: 1,
  });

  const block = render(S([ArrayBlock<T>, { source, meta }]));

  return { block, source, meta };
};
