import type { Distinctor, IReactiveState } from '../../reactive-state';
import type { IStateClosure } from '../../state-closure';
import type { ImmediateDescriptor, StateClosureClass } from '../type';

import { immediateDescriptor } from './consts';

export type RuntimeImmediateDescriptor<T> = ImmediateDescriptor<T> & {
  readonly [immediateDescriptor]: T;
};

// oxlint-disable-next-line typescript/no-explicit-any
export type AnyStateClosureClass = StateClosureClass<any, any[]>;

// oxlint-disable-next-line typescript/no-explicit-any
export type AnyMappingFunction = (params: any) => any;

export type RuntimeSlottedDescriptor = readonly [
  AnyStateClosureClass | AnyMappingFunction,
  unknown,
  Distinctor<unknown>?,
];

export type ResolvedMappingNode =
  | { readonly type: 'constant'; readonly value: unknown }
  | { readonly type: 'state'; readonly state: IReactiveState<unknown> }
  | readonly ResolvedMappingNode[]
  | { readonly [key: string]: ResolvedMappingNode };

export type BuiltStateClosure = IStateClosure<unknown>;
