import type { IReactiveState } from '@flowdown/reactive';

import { BaseStateClosure, ReactiveState } from '@flowdown/reactive';

import { IRangeState } from '../range';
import {
  BaseBlockStateClosureParams,
  IBlockMeta,
  IBlockState,
  IBlockStateCloneParams,
  IBlockStateMapper,
} from './type';

export * from './type';

export abstract class BaseBlockStateClosure<T>
  extends BaseStateClosure<T>
  implements IBlockState<T>
{
  private source: IReactiveState<T>;

  private mapper: IBlockStateMapper<T> | undefined;

  readonly meta: IReactiveState<IBlockMeta>;

  readonly range: IReactiveState<IRangeState | null>;

  readonly length: ReactiveState<number>;

  readonly baseLength: ReactiveState<number>;

  constructor({ source, meta, range, mapper }: BaseBlockStateClosureParams<T>) {
    super({ source: () => this.getValueState(), lazy: true });

    this.meta = meta;

    this.source = source;

    this.range = range ?? this.clearable(ReactiveState.of(null));

    this.mapper = mapper;

    this.baseLength = this.getBaseLengthState();

    this.length = this.getLengthState();
  }

  protected abstract slice(value: T, start: number, end: number): T;

  protected abstract lengthOf(value: T): number;

  protected abstract create(params: BaseBlockStateClosureParams<T>): IBlockState<T>;

  private getValueState() {
    const rawValue = this.combineMap([this.source, this.range], ([currentValue, currentRange]) => {
      if (!currentRange) {
        return currentValue;
      }

      const { start = 0, end = Infinity } = currentRange;

      return this.slice(currentValue, start, end);
    });

    const { mapper } = this;

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
    return this.map(this.source, (currentValue) => {
      return this.lengthOf(currentValue);
    });
  }

  fork({ meta, mapper, range }: IBlockStateCloneParams<T> = {}): IBlockState<T> {
    const forkedItem = this.create({
      source: this.source,
      meta: meta ?? this.meta,
      range: range ?? this.range,
      mapper: mapper ?? this.mapper,
    });

    return forkedItem;
  }
}
