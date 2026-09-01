// oxlint-disable-next-line typescript/no-explicit-any
type StateMapper = (inputs: any) => any;

declare const ImmediateStateMapperKey: unique symbol;

export type ImmediateStateMapperMetadata = {
  readonly [ImmediateStateMapperKey]: true;
};

export type ImmediateStateMapper<M extends StateMapper = StateMapper> = M &
  ImmediateStateMapperMetadata;

export type AnyImmediateStateMapper = ImmediateStateMapper;

/** Types mapper inputs as immediate descriptors without changing runtime behavior. */
export const immediate = <M extends StateMapper>(mapper: M): ImmediateStateMapper<M> => {
  return mapper as ImmediateStateMapper<M>;
};
