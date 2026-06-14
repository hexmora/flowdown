<!--
PR title convention:

  <conventional commit>

Examples:
  feat(core): add streaming markdown parser state
  fix(react): avoid rerendering stable markdown blocks
  docs: document package boundaries

If an AI agent is preparing a lettered PR sequence at the maintainer's request:

  PR-A: <conventional commit>
-->

## Summary

<!-- What changed and why? Keep this specific and reviewable. -->

- 

## Test Plan

<!-- Check every item that applies, and add any manual verification steps. -->

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm build:storybook`
- [ ] Manual verification:

## Package Boundary Checklist

- [ ] `@flowdown/core` remains headless and free of React/rendering dependencies.
- [ ] React, Storybook, DOM, hooks, and UI rendering concerns live in `@flowdown/react`.
- [ ] Type/env declarations are under `src/typings/`.
- [ ] Generated artifacts are not committed.

## Related

<!-- Link issues, discussions, follow-up PRs, or design notes. -->
