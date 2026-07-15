import type { Parent, RootContent } from 'mdast';

import { first, last } from 'lodash-es';

import { assert } from '../assert';
import { isMdastParent } from './detect';

export interface ProcessMdastParams<T extends RootContent | Parent = Parent> {
  /**
   * Root node where the traversal starts.
   */
  node: RootContent | T;

  /**
   * Callback invoked when a node is visited.
   */
  runner: ProcessMdastRunner<T>;

  /**
   * Traversal order:
   * - pre: pre-order traversal
   * - post: post-order traversal
   * - in: in-order traversal, extended from binary trees; in an n-ary tree,
   *   a non-leaf node is visited the second time it is encountered.
   * @default 'pre'
   */
  order?: 'pre' | 'post' | 'in';

  /**
   * Whether to reverse left and right order. When true, right nodes are visited
   * before left nodes, while the parent-child visit order remains unchanged.
   * @default false
   */
  rightFirst?: boolean;
}

export type ProcessMdastRunnerParams<T extends RootContent | Parent = Parent> = {
  /**
   * Node currently being visited.
   */
  node: RootContent | T;

  /**
   * Direct parent of the current node.
   */
  parent: Parent | undefined;

  /**
   * Parent node list, ordered from nearest to farthest.
   */
  parents: Parent[];

  /**
   * Index of the current node within its parent.
   */
  index: number | undefined;

  /**
   * Stops the traversal after the current visit.
   */
  break: () => void;

  /**
   * Skips the current node's child tree when traversal order allows it.
   */
  skipTree: () => void;

  /**
   * Inserts nodes immediately after the current node, or replaces it when requested.
   */
  insertNext: (content: RootContent[], replaceCurrent?: boolean) => void;
};

export type ProcessMdastRunner<T extends RootContent | Parent = Parent> = (
  /**
   * Visit payload containing the current node, traversal context, and actions.
   */
  params: ProcessMdastRunnerParams<T>,
) => void;

type ProcessFrame<T> = {
  /**
   * Parent chain captured for this stack frame.
   */
  parents: Parent[];

  /**
   * Node scheduled by this stack frame.
   */
  node: RootContent | T;
};

/**
 * Performs depth-first traversal with an explicit stack and lets the runner
 * mutate the AST while walking it. Newly inserted nodes are not scheduled from
 * the current frame, which keeps unsafe runners from creating infinite loops.
 * @param params Parameters for the traversal.
 */
export const processMdast = <T extends RootContent | Parent>({
  node: root,
  runner,
  order = 'pre',
  rightFirst = false,
}: ProcessMdastParams<T>) => {
  let stopped = false;

  let skipped = false;

  /** Guards action callbacks captured and called after traversal has finished. */
  let closed = false;

  /** Each stack frame carries the node plus its parent chain, nearest parent first. */
  const stack: ProcessFrame<T>[] = [{ parents: [], node: root }];

  /** Used by post/in traversal to tell whether a child frame has already run. */
  const seen: Array<Parent | RootContent> = [];

  const markSeen = (item: Parent | RootContent) => {
    if (!seen.includes(item)) {
      seen.push(item);
    }
  };

  const childrenOf = (owner: RootContent | T, parents: Parent[]): ProcessFrame<T>[] => {
    if (!isMdastParent(owner)) {
      return [];
    }

    /** Snapshot children before runner callbacks can mutate the tree. */
    const children = owner.children.slice();
    const ordered = rightFirst
      ? children
      : /** The stack is LIFO, so left-first traversal pushes children in reverse order. */
        children.reduceRight<RootContent[]>((result, child) => {
          result.push(child);

          return result;
        }, []);

    return ordered.map((child) => ({
      parents: [owner, ...parents],
      node: child,
    }));
  };

  const assertOpen = (name: 'break' | 'skipTree') => {
    if (closed) {
      throw Error(`processMdast: ${name} must be called during a visit`);
    }
  };

  while (stack.length) {
    const frame = stack.pop();

    assert(frame, 'processMdast: missing stack frame');

    const { parents, node } = frame;
    const parent = first(parents);
    const children = childrenOf(node, parents);

    const insertNext = (content: RootContent[], replaceCurrent = false) => {
      if (!parent) {
        return;
      }

      const offset = parent.children.findIndex((child) => child === node);

      assert(offset !== -1, 'processMdast: cannot insert next to a detached node');

      if (replaceCurrent) {
        parent.children.splice(offset, 1, ...content);
      } else {
        parent.children.splice(offset + 1, 0, ...content);
      }
    };

    const breakWalk = () => {
      assertOpen('break');
      stopped = true;
    };

    const skipTree = () => {
      assertOpen('skipTree');
      skipped = true;
    };

    const run = () => {
      const index = parent?.children.findIndex((child) => child === node);

      /** A previously scheduled child may have been removed by an earlier runner. */
      if (index === -1) {
        return;
      }

      runner({
        node,
        break: breakWalk,
        skipTree,
        insertNext,
        parent,
        parents,
        index,
      });
    };

    switch (order) {
      case 'pre': {
        run();

        if (!skipped) {
          stack.push(...children);
        }

        break;
      }

      case 'post': {
        /** Requeue the parent until every current child has been visited. */
        const pending = children.filter(({ node: child }) => !seen.includes(child));

        if (pending.length) {
          stack.push(frame);
          stack.push(...pending);
        } else {
          run();
          markSeen(node);
        }

        break;
      }

      case 'in': {
        /** Split once: visit the first child path, then the parent, then the rest. */
        const split =
          isMdastParent(node) &&
          children.length > 0 &&
          children.every(({ node: child }) => !seen.includes(child));

        if (split) {
          const rest = children.slice(0, -1);
          const next = last(children);

          stack.push(...rest);
          stack.push(frame);

          if (next) {
            stack.push(next);
          }
        } else {
          run();
          markSeen(node);
        }

        break;
      }
    }

    if (stopped) {
      break;
    }

    stopped = false;
    skipped = false;
  }

  closed = true;
};
