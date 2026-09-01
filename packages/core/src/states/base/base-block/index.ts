import type { IReactiveState } from 'reactive';

import { BaseStateClosure, ReactiveState } from 'reactive';

import type { IRangeState } from '../range';
import type {
  BaseBlockStateClosureInputs,
  BlockStateClosureClass,
  IBlockMeta,
  IBlockState,
  IBlockStateCloneParams,
} from './type';

export * from './type';

export abstract class BaseBlockStateClosure<T>
  extends BaseStateClosure<T, BaseBlockStateClosureInputs<T>>
  implements IBlockState<T>
{
  readonly meta: IReactiveState<IBlockMeta>;

  readonly range: IReactiveState<IRangeState | null>;

  readonly length: ReactiveState<number>;

  readonly baseLength: ReactiveState<number>;

  constructor(inputs: BaseBlockStateClosureInputs<T>) {
    super(inputs);

    const { meta, range } = this.inputs;

    this.meta = meta;

    this.range = range ?? this.clearable(ReactiveState.of(null));

    this.baseLength = this.getBaseLengthState();

    this.length = this.getLengthState();
  }

  protected abstract slice(value: T, start: number, end: number): T;

  protected abstract lengthOf(value: T): number;

  protected render() {
    const { mapper, source } = this.inputs;

    const rawValue = this.combineMap([source, this.range], ([currentValue, currentRange]) => {
      if (!currentRange) {
        return currentValue;
      }

      const { start = 0, end = Infinity } = currentRange;

      return this.slice(currentValue, start, end);
    });

    if (mapper) {
      return mapper(rawValue, this);
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
    const { mapper: inputMapper, source } = this.inputs;

    const StateClosure = this.constructor as BlockStateClosureClass<T>;

    return new StateClosure({
      source,
      meta: meta ?? this.meta,
      range: range ?? this.range,
      mapper: mapper ?? inputMapper,
    });
  }
}
