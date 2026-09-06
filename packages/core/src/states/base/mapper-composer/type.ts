import type { IReadableClosure, JSXDescriptor, OnceFunction } from 'reactive';

import type { HastRoot } from '../../../typings';
import type { IBlockState } from '../base-block';

export interface MapperInputs {
  source: IReadableClosure<IBlockState<HastRoot>[]>;
}

export type MapperResult =
  | IReadableClosure<IBlockState<HastRoot>[]>
  | JSXDescriptor<IBlockState<HastRoot>[]>;

export type Mapper<C extends object = {}> = OnceFunction<
  (inputs: MapperInputs & C) => MapperResult
>;

/** Keeps the source contract while accepting configured closures in heterogeneous lists. */
type ConfiguredMapper = OnceFunction<
  {
    create(inputs: MapperInputs): MapperResult;
  }['create']
>;

export type MapperPluggable<C extends object = never> =
  | Mapper
  | ([C] extends [never] ? [ConfiguredMapper, object] : [Mapper<C>, C]);

export interface MapperComposerInputs extends MapperInputs {
  mappers: IReadableClosure<MapperPluggable[]>;
}
