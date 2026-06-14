# Claude Code Guidance

This repository's general agent instructions live in `AGENTS.md`. Read that
file first; this file only adds Claude-specific reminders.

## Default Working Style

- Treat Flowdown as an open-source library, not an application repository.
- Keep `@flowdown/core` headless and UI-free.
- Put React, Storybook, hooks, DOM, and rendering-layer dependencies in
  `@flowdown/react`.
- Keep generated files out of commits.
- Prefer small, focused PRs with complete test plans.

## Validation

Use pnpm from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm build:storybook
```

`build:storybook` may warn that no story files exist while the scaffold is
empty. That is acceptable as long as the command exits successfully.

## GitHub PRs

Use Conventional Commit titles for PRs. If the maintainer asks for
agent-lettered PRs, use `PR-A: <conventional commit title>`, then continue with
`PR-B`, `PR-C`, and so on.

PR descriptions should be review-ready and include:

- Summary
- Test plan
- Related issues or notes

Do not include private environment details, local absolute paths, credentials,
or unrelated implementation notes in public PRs.
