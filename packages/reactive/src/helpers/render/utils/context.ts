import type { IStateClosure } from '../../../modules/state-closure';

type DescriptorScopeResource =
  | { cleanup: () => void; scope?: never }
  | { cleanup?: never; scope: DescriptorScope };

export type DescriptorScope = {
  destroyed: boolean;
  parent: DescriptorScope | null;
  resources: DescriptorScopeResource[];
};

export const createDescriptorScope = (parent: DescriptorScope | null = null): DescriptorScope => {
  const scope: DescriptorScope = {
    destroyed: false,
    parent,
    resources: [],
  };

  parent?.resources.push({ scope });

  return scope;
};

export const assertDescriptorScope = (scope: DescriptorScope) => {
  if (scope.destroyed) {
    throw new TypeError('Cannot build from a destroyed descriptor graph.');
  }
};

export const clearWithDescriptorScope = (scope: DescriptorScope, cleanup: () => void) => {
  scope.resources.push({ cleanup });
};

export const ownStateClosure = <T extends IStateClosure<unknown>>(
  scope: DescriptorScope,
  closure: T,
): T => {
  clearWithDescriptorScope(scope, () => closure.destroy());

  return closure;
};

const removeFromParent = (scope: DescriptorScope) => {
  const { parent } = scope;

  if (!parent || parent.destroyed) {
    return;
  }

  const index = parent.resources.findIndex((resource) => resource.scope === scope);

  if (index >= 0) {
    parent.resources.splice(index, 1);
  }
};

export const destroyDescriptorScope = (scope: DescriptorScope) => {
  if (scope.destroyed) {
    return;
  }

  scope.destroyed = true;
  removeFromParent(scope);

  const resources = scope.resources.splice(0);

  for (const resource of resources) {
    if (resource.scope) {
      destroyDescriptorScope(resource.scope);
    } else {
      resource.cleanup();
    }
  }
};

export const bindRootDescriptorScope = <T extends IStateClosure<unknown>>(
  scope: DescriptorScope,
  closure: T,
): T => {
  const destroy = closure.destroy.bind(closure);

  closure.destroy = () => {
    destroy();
    destroyDescriptorScope(scope);
  };

  return closure;
};
