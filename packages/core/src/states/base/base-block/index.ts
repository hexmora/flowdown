import type {
  BaseBlockItemInputs,
  BlockItemClass,
  IBlockMeta,
  IBlockState,
  IBlockStateCloneParams,
  IRangeState,
} from '@fluxdown/types';
import type { IReactiveState, IReadableClosure } from 'functive';

import { BaseStateClosure, toClosure } from 'functive';

export abstract class BaseBlockItem<T>
  extends BaseStateClosure<T, BaseBlockItemInputs<T>>
  implements IBlockState<T>
{
  private readonly rangeSource: IReadableClosure<IRangeState | null>;

  private readonly baseLengthSource: IReadableClosure<number>;

  private lengthSource: IReadableClosure<number> | null = null;

  constructor(inputs: BaseBlockItemInputs<T>) {
    super(inputs);

    const { range } = this.inputs;

    this.rangeSource = this.defaults(range, null);

    this.baseLengthSource = this.getBaseLengthState();
  }

  get meta(): IReactiveState<IBlockMeta> {
    const { meta } = this.inputs;

    return meta.value;
  }

  get range(): IReactiveState<IRangeState | null> {
    return this.rangeSource.value;
  }

  get length(): IReactiveState<number> {
    return (this.lengthSource ??= this.getLengthState()).value;
  }

  get baseLength(): IReactiveState<number> {
    return this.baseLengthSource.value;
  }

  protected abstract slice(value: T, start: number, end: number): T;

  protected abstract lengthOf(value: T): number;

  protected render() {
    const { mapper, source } = this.inputs;

    const rawValue = this.combineMap([source, this.rangeSource], ([currentValue, currentRange]) => {
      if (!currentRange) {
        return currentValue;
      }

      const { start = 0, end = Infinity } = currentRange;

      return this.slice(currentValue, start, end);
    });

    if (mapper) {
      return mapper(rawValue.value, this);
    }

    return rawValue;
  }

  protected getLengthState() {
    return this.map(this.value, (currentValue) => {
      return this.lengthOf(currentValue);
    });
  }

  private getBaseLengthState() {
    const { source } = this.inputs;

    return this.map(source, (currentValue) => {
      return this.lengthOf(currentValue);
    });
  }

  fork({ meta, mapper, range }: IBlockStateCloneParams<T> = {}): IBlockState<T> {
    const { mapper: inputMapper, source, meta: inputMeta } = this.inputs;

    const Block = this.constructor as BlockItemClass<T>;

    return new Block({
      source,
      meta: toClosure(meta ?? inputMeta),
      range: toClosure(range ?? this.rangeSource),
      mapper: mapper ?? inputMapper,
    });
  }
}
