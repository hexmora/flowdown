import { reverse } from 'lodash-es';
import { Subscription } from 'rxjs';

import type { IReadableClosure } from '../../../type';

export type DescriptorScope = {
  detached: boolean;
  destroyed: boolean;
  closures: Set<IReadableClosure<unknown>>;
  detachers: Array<() => void>;
  resources: Array<() => void>;
};

type ClosureContext = {
  scope: DescriptorScope | null;
  owners: Set<DescriptorScope>;
};

const closureContext = /*#__PURE__*/ Symbol('closureContext');

let constructionScope: DescriptorScope | null = null;

const getClosureContext = (
  closure: IReadableClosure<unknown> & { [closureContext]?: ClosureContext },
): ClosureContext => {
  const existing = Object.hasOwn(closure, closureContext) ? closure[closureContext] : undefined;

  if (existing) {
    return existing;
  }

  const context: ClosureContext = { scope: null, owners: new Set() };

  Object.defineProperty(closure, closureContext, { value: context });

  return context;
};

export const withDescriptorScope = <T>(scope: DescriptorScope, callback: () => T): T => {
  const previous = constructionScope;

  constructionScope = scope;

  try {
    return callback();
  } finally {
    constructionScope = previous;
  }
};

export const consumeDescriptorScope = (): DescriptorScope | null => {
  const scope = constructionScope;

  constructionScope = null;

  return scope;
};

export const createDescriptorScope = (): DescriptorScope => ({
  detached: false,
  destroyed: false,
  closures: new Set(),
  detachers: [],
  resources: [],
});

export const assertDescriptorScope = (scope: DescriptorScope) => {
  if (scope.detached || scope.destroyed) {
    throw new TypeError('Cannot build from a destroyed descriptor graph.');
  }
};

export const clearWithDescriptorScope = (scope: DescriptorScope, cleanup: () => void) => {
  scope.resources.push(cleanup);
};

export const detachWithDescriptorScope = (scope: DescriptorScope, detach: () => void) => {
  scope.detachers.push(detach);
};

export const ownReadableClosure = <T extends IReadableClosure<unknown>>(
  scope: DescriptorScope,
  closure: T,
): T => {
  if (scope.closures.has(closure)) {
    return closure;
  }

  const { owners } = getClosureContext(closure);

  owners.add(scope);

  scope.closures.add(closure);

  return closure;
};

export const releaseReadableClosure = (
  scope: DescriptorScope,
  closure: IReadableClosure<unknown>,
) => {
  if (!scope.closures.delete(closure)) {
    return;
  }

  const { owners } = getClosureContext(closure);

  owners.delete(scope);

  if (owners.size === 0) {
    closure.destroy();
  }
};

const detachDescriptorScope = (scope: DescriptorScope) => {
  if (scope.detached) {
    return;
  }

  scope.detached = true;

  const teardown = new Subscription();

  for (const detach of reverse(scope.detachers.splice(0))) {
    teardown.add(detach);
  }

  for (const closure of scope.closures) {
    teardown.add(() => {
      const { scope: childScope, owners } = getClosureContext(closure);

      if (childScope && [...owners].every((owner) => owner.detached)) {
        detachDescriptorScope(childScope);
      }
    });
  }

  teardown.unsubscribe();
};

export const destroyDescriptorScope = (scope: DescriptorScope, destroy?: () => void) => {
  if (scope.destroyed) {
    return;
  }

  scope.destroyed = true;

  const teardown = new Subscription(() => detachDescriptorScope(scope));

  for (const closure of reverse([...scope.closures])) {
    teardown.add(() => releaseReadableClosure(scope, closure));
  }

  teardown.add(destroy);

  for (const cleanup of scope.resources.splice(0)) {
    teardown.add(cleanup);
  }

  teardown.unsubscribe();
};

export const bindRootDescriptorScope = <T extends IReadableClosure<unknown>>(
  scope: DescriptorScope,
  closure: T,
): T => {
  const context = getClosureContext(closure);

  const previous = context.scope;

  if (previous === scope) {
    return closure;
  }

  if (previous) {
    scope.resources.push(...previous.resources.splice(0));

    scope.detachers.push(...previous.detachers.splice(0));

    for (const child of previous.closures) {
      ownReadableClosure(scope, child);

      releaseReadableClosure(previous, child);
    }
  } else {
    const destroy = closure.destroy.bind(closure);

    closure.destroy = () => {
      destroyDescriptorScope(context.scope!, destroy);
    };
  }

  context.scope = scope;

  return closure;
};

export const getReadableClosureScope = (closure: IReadableClosure<unknown>): DescriptorScope => {
  const { scope: current } = getClosureContext(closure);

  if (current) {
    return current;
  }

  const scope = createDescriptorScope();

  bindRootDescriptorScope(scope, closure);

  return scope;
};
