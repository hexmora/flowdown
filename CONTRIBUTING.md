# Contributing

Thank you for your interest in Fluxdown.

## Development

Use the Node.js version in `.node-version` and the pinned pnpm version.
Run `pnpm install` after changing dependencies.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm build:storybook
```

For a single project, use its directory name as the moon project ID:

```bash
pnpm exec moon run core:build
pnpm exec moon run react:test
pnpm exec moon tasks
```

Place package tests in `__tests__` directories.

Every PR that changes a workspace package's `src/**` must add a new, nonempty
Changeset naming every affected package with a `patch`, `minor`, or `major` bump,
including private packages. Commit it with the source changes; existing or empty
Changesets do not satisfy this requirement.

```bash
pnpm changeset
pnpm check
pnpm publish:dry-run
```

See [the release guide](docs/releasing.md) for versioning, dry runs, and publishing.

## Branches

Create a focused topic branch for PR-based work:

```text
feat/core-stream-state
fix/react-render-cache
docs/open-source-guidelines
```

Avoid mixing unrelated changes in one branch.

## Commit Messages

Use Conventional Commits:

```text
type(scope): summary
```

Examples:

```text
feat(core): add streaming markdown parser state
fix(react): avoid rerendering stable markdown blocks
docs: document package boundaries
chore: update pnpm catalog entries
```

Use `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`, or `ci` when
one of those clearly fits. Keep the summary imperative and concise.

## Pull Requests

- Keep changes focused and easy to review.
- Add or update tests when behavior changes.
- Run the validation commands before opening a pull request.
- Use a Conventional Commit PR title, matching the intended squash commit.
- Include a clear summary, exact test plan, and related issue links.
- Include screenshots or recordings for visible React/Storybook changes.
- Do not include private environment details, credentials, or local-only paths.

## Reporting Issues

Please include a minimal reproduction, the package version, runtime version, and expected behavior when reporting bugs.
