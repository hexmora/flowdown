# Agent Guidelines

This file gives AI coding agents the project conventions for Flowdown. Keep
changes small, reviewable, and aligned with the package boundaries below.

## Project Shape

Flowdown is a pnpm monorepo.

```text
packages/
  core/   Headless Markdown stream computation.
  react/  React rendering bindings built on top of core.
```

Package responsibilities:

- `@flowdown/core` must stay headless. Do not add React, Storybook, DOM rendering,
  hooks, or UI-only dependencies here.
- `@flowdown/react` owns React rendering, Storybook, Testing Library, jsdom,
  hooks, and UI/runtime rendering dependencies.
- Shared dependency versions that are intentionally coordinated across packages
  should be declared in `pnpm-workspace.yaml` under `catalog`.
- React runtime compatibility is pinned to React 18 through catalog entries and
  pnpm overrides.
- Type/env declaration files belong under `src/typings/`.

## Commands

Use pnpm directly from the repository root.

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm build:storybook
```

Before handing work back, run the narrowest checks that cover the change. For
cross-package or release-facing changes, run the full validation set above.

## Workflow

- Work in small, reviewable changes.
- Inspect the existing package style before adding new files.
- Do not commit generated artifacts such as `dist/`, `storybook-static/`,
  `coverage/`, or `node_modules/`.
- Check `git status` and `git diff` before committing.
- Only commit your own changes. If unrelated user changes are present, leave
  them alone.

## Git And Commit Conventions

Use Conventional Commits:

```text
type(scope): summary
```

Common types:

- `feat`: user-facing feature
- `fix`: bug fix
- `docs`: documentation-only change
- `chore`: tooling, maintenance, package metadata
- `refactor`: behavior-preserving code restructuring
- `test`: tests only
- `build`: build system or dependency changes
- `ci`: GitHub Actions or CI configuration

Examples:

```text
feat(core): add streaming markdown parser state
fix(react): avoid rerendering stable markdown blocks
docs: document package boundaries
chore: update pnpm catalog entries
```

Keep the summary imperative, lowercase after the type, and under roughly 72
characters when practical.

## Branch And PR Workflow

For PR-based work, create a topic branch instead of committing directly to
`main`.

```text
chore/open-source-guidelines
feat/core-stream-state
fix/react-render-cache
```

PR titles should normally be the Conventional Commit title that would describe
the squash commit:

```text
docs: add contributor and agent guidelines
feat(core): add markdown stream state
```

If an AI agent is preparing a series of related PRs and the maintainer wants
lettered tracking, use:

```text
PR-A: <conventional commit title>
PR-B: <conventional commit title>
```

and branch names like:

```text
pr-a/open-source-guidelines
```

## PR Body Expectations

Every PR should include:

- A concise summary of what changed and why.
- A test plan with the exact commands or manual checks performed.
- Links to issues or follow-up work when relevant.
- Screenshots or recordings for visual React/Storybook changes.

For multi-theme PRs, group the summary by theme so reviewers can inspect each
area independently.
